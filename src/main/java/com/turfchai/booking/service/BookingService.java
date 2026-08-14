package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.booking.event.SlotStatusChangedEvent;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingService {

    private static final long HOLD_DURATION_MINUTES = 5;
    private static final int BOOKING_CODE_MAX_ATTEMPTS = 10;

    private final SlotRepository slotRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    /**
     * Slot changes are announced here but delivered only after this
     * transaction commits — see {@link SlotEventBroadcaster}.
     */
    private final ApplicationEventPublisher events;

    /**
     * Acquires a 5-minute hold on a slot. The row is locked with
     * PESSIMISTIC_WRITE so concurrent hold attempts serialize on the DB row.
     * An expired hold left behind by a previous user can be re-acquired.
     * <p>
     * Re-entrant for the caller's own active hold: a second call from the
     * same user before it expires refreshes the 5-minute window instead of
     * failing. This is the common case in practice — a duplicate mount
     * effect (React StrictMode double-invokes effects in dev), a retried
     * request, or the user re-opening checkout for the same slot — not just
     * a contrived edge case, so it must succeed rather than 409.
     * </p>
     */
    @Transactional
    public OffsetDateTime holdSlot(Long userId, Long slotId) {
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + slotId));

        OffsetDateTime now = OffsetDateTime.now();
        boolean expiredHold = slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(now);
        boolean ownActiveHold = slot.getStatus() == SlotStatus.HELD
                && userId != null
                && userId.equals(slot.getHeldByUserId())
                && !expiredHold;

        if (slot.getStatus() == SlotStatus.AVAILABLE || expiredHold || ownActiveHold) {
            OffsetDateTime heldUntil = now.plusMinutes(HOLD_DURATION_MINUTES);
            slot.setStatus(SlotStatus.HELD);
            slot.setHeldByUserId(userId);
            slot.setHoldExpiresAt(heldUntil);
            slotRepository.save(slot);
            events.publishEvent(SlotStatusChangedEvent.held(
                    slot.getId(), slot.getVenueId(), slot.getSlotDate(), heldUntil));
            return heldUntil;
        }
        throw new SlotUnavailableException("Slot is not available for booking");
    }

    /**
     * Converts the caller's active hold into a confirmed booking. The slot is
     * re-locked to guarantee the hold is still valid (owned, not expired)
     * before committing the booking.
     */
    @Transactional
    public Booking confirmBooking(Long userId, Long slotId) {
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + slotId));

        if (!isOwnedActiveHold(slot, userId)) {
            throw new SlotUnavailableException("Slot hold is invalid, not owned by this user, or has expired");
        }

        slot.setStatus(SlotStatus.BOOKED);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);
        slotRepository.save(slot);
        events.publishEvent(SlotStatusChangedEvent.of(
                slot.getId(), slot.getVenueId(), slot.getSlotDate(), SlotStatus.BOOKED));

        Booking booking = Booking.builder()
                .bookingCode(generateBookingCode())
                .slot(slot)
                .userId(userId)
                .status(BookingStatus.CONFIRMED)
                .venueId(slot.getVenueId())
                .pitchId(slot.getPitch() != null ? slot.getPitch().getId() : null)
                .bookingDate(slot.getSlotDate())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .grossAmount(slot.getPrice())
                .netAmount(slot.getPrice())
                .build();
        return bookingRepository.save(booking);
    }

    /**
     * Creates (or reuses) a {@link BookingStatus#PENDING} booking for the
     * caller's active hold, ahead of a payment attempt. Unlike
     * {@link #confirmBooking}, the slot is left {@code HELD} — payment
     * gates confirmation, so the existing 5-minute hold/cleanup-job
     * lifecycle keeps governing the slot until {@link #finalizeConfirmedBooking}
     * runs. Idempotent per user+slot: a retried payment attempt (e.g. after
     * a declined card) reuses the same pending booking rather than creating
     * a duplicate row.
     */
    @Transactional
    public Booking createPendingBooking(Long userId, Long slotId) {
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + slotId));

        if (!isOwnedActiveHold(slot, userId)) {
            throw new SlotUnavailableException("Slot hold is invalid, not owned by this user, or has expired");
        }

        return bookingRepository.findBySlotIdAndUserIdAndStatus(slotId, userId, BookingStatus.PENDING)
                .orElseGet(() -> bookingRepository.save(Booking.builder()
                        .bookingCode(generateBookingCode())
                        .slot(slot)
                        .userId(userId)
                        .status(BookingStatus.PENDING)
                        .venueId(slot.getVenueId())
                        .pitchId(slot.getPitch() != null ? slot.getPitch().getId() : null)
                        .bookingDate(slot.getSlotDate())
                        .startTime(slot.getStartTime())
                        .endTime(slot.getEndTime())
                        .grossAmount(slot.getPrice())
                        .netAmount(slot.getPrice())
                        .build()));
    }

    /**
     * The second half of what {@link #confirmBooking} does in one step:
     * flips a {@link BookingStatus#PENDING} booking (created via
     * {@link #createPendingBooking} ahead of a payment attempt) to
     * {@code CONFIRMED} and its slot to {@code BOOKED}, once payment has
     * actually succeeded.
     */
    @Transactional
    public void finalizeConfirmedBooking(Booking booking) {
        Slot slot = slotRepository.findByIdForUpdate(booking.getSlot().getId())
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + booking.getSlot().getId()));

        slot.setStatus(SlotStatus.BOOKED);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);
        slotRepository.save(slot);
        events.publishEvent(SlotStatusChangedEvent.of(
                slot.getId(), slot.getVenueId(), slot.getSlotDate(), SlotStatus.BOOKED));

        booking.setStatus(BookingStatus.CONFIRMED);
        bookingRepository.save(booking);
    }

    private boolean isOwnedActiveHold(Slot slot, Long userId) {
        return slot.getStatus() == SlotStatus.HELD
                && userId != null
                && userId.equals(slot.getHeldByUserId())
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isAfter(OffsetDateTime.now());
    }

    /**
     * Cancels a booking and releases its slot back to AVAILABLE. The caller
     * must be the booking owner or an admin/owner role.
     */
    @Transactional
    public void cancelBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new SlotUnavailableException("Booking not found with id: " + bookingId));

        if (!canAccess(userId, booking)) {
            throw new AccessDeniedException("You do not have permission to cancel this booking");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        Slot slot = booking.getSlot();
        slot.setStatus(SlotStatus.AVAILABLE);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);

        bookingRepository.save(booking);
        slotRepository.save(slot);
        events.publishEvent(SlotStatusChangedEvent.of(
                slot.getId(), slot.getVenueId(), slot.getSlotDate(), SlotStatus.AVAILABLE));
    }

    /** Returns a booking only to its owner or an admin/owner role. */
    @Transactional(readOnly = true)
    public Booking getBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new SlotUnavailableException("Booking not found with id: " + bookingId));
        if (!canAccess(userId, booking)) {
            throw new SlotUnavailableException("Booking not found with id: " + bookingId);
        }
        return booking;
    }

    /** Lists the caller's own bookings. */
    @Transactional(readOnly = true)
    public List<Booking> listUserBookings(Long userId) {
        return bookingRepository.findByUserId(userId);
    }

    /**
     * Full view of a booking. The venue and pitch names are resolved here so
     * the booking screens can render without a second round trip per card.
     */
    @Transactional(readOnly = true)
    public BookingResponse toResponse(Booking booking) {
        var venue = booking.getVenueId() == null
                ? null
                : venueRepository.findById(booking.getVenueId()).orElse(null);
        var pitch = booking.getPitchId() == null
                ? null
                : pitchRepository.findById(booking.getPitchId()).orElse(null);

        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .slotId(booking.getSlot() != null ? booking.getSlot().getId() : null)
                .userId(booking.getUserId())
                .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                .venueId(booking.getVenueId())
                .venueName(venue != null ? venue.getName() : null)
                .venueSlug(venue != null ? venue.getSlug() : null)
                .venueArea(venue != null ? venue.getArea() : null)
                .pitchId(booking.getPitchId())
                .pitchName(pitch != null ? pitch.getName() : null)
                .bookingDate(booking.getBookingDate())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .amount(booking.getGrossAmount())
                .netAmount(booking.getNetAmount())
                .checkedInAt(booking.getCheckedInAt())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }

    private boolean canAccess(Long userId, Booking booking) {
        if (userId != null && userId.equals(booking.getUserId())) {
            return true;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AccessDeniedException("You do not have permission to access this booking"));
        return isAdminOrOwner(user.getRole());
    }

    private boolean isAdminOrOwner(RoleType role) {
        return role == RoleType.ADMIN || role == RoleType.SUPER_ADMIN || role == RoleType.OWNER;
    }

    private String generateBookingCode() {
        for (int attempt = 0; attempt < BOOKING_CODE_MAX_ATTEMPTS; attempt++) {
            String code = "TC-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            if (bookingRepository.findByBookingCode(code).isEmpty()) {
                return code;
            }
        }
        throw new IllegalStateException("Could not generate a unique booking code");
    }
}
