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
import com.turfchai.exception.BookingNotFoundException;
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
    private final SlotTimePolicy slotTimePolicy;
    private final com.turfchai.promotion.service.PromotionService promotionService;
    private final com.turfchai.service.NotificationService notificationService;
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

        slotTimePolicy.assertNotStarted(slot);

        if (slot.getVenueId() != null) {
            venueRepository.findById(slot.getVenueId()).ifPresent(v -> {
                if (v.getStatus() != null && ("OFFLINE".equalsIgnoreCase(v.getStatus().trim())
                        || "SUSPENDED".equalsIgnoreCase(v.getStatus().trim()))) {
                    throw new SlotUnavailableException("Turf is currently unavailable / offline.");
                }
            });
        }

        OffsetDateTime now = OffsetDateTime.now();
        boolean expiredHold = slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(now);
        boolean ownActiveHold = slot.getStatus() == SlotStatus.HELD
                && userId != null
                && userId.equals(slot.getHeldByUserId())
                && !expiredHold;

        // One active hold per player at a time. Without this, a player could
        // hold a second slot while still sitting on the first, tying up two
        // venues' inventory for the same 5-minute window with no way to tell
        // which one they actually meant to book — this is also what keeps
        // the "resume your booking" prompt on the frontend pointing at a
        // single, unambiguous slot.
        if (!ownActiveHold) {
            slotRepository.findActiveHoldsByUser(userId, SlotStatus.HELD, now)
                    .stream()
                    .filter(other -> !other.getId().equals(slotId))
                    .findFirst()
                    .ifPresent(other -> {
                        throw new SlotUnavailableException(
                                "You already have a slot on hold (slot " + other.getId()
                                        + "). Finish or let that hold expire before holding another.");
                    });
        }

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
     * The caller's currently active hold, if any — powers the "you have a
     * booking in progress" prompt shown across the player app so a player
     * who navigated away mid-checkout can find their way back to it.
     */
    @Transactional(readOnly = true)
    public java.util.Optional<Slot> getActiveHold(Long userId) {
        if (userId == null) {
            return java.util.Optional.empty();
        }
        return slotRepository.findActiveHoldsByUser(userId, SlotStatus.HELD, OffsetDateTime.now())
                .stream()
                .findFirst();
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

        slotTimePolicy.assertNotStarted(slot);

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

        slotTimePolicy.assertNotStarted(slot);

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
     *
     * <p>
     * It re-verifies the booking and the hold under the slot lock. It used to
     * force both rows regardless of what had happened in between, so a payment
     * arriving after the hold expired — and after somebody else had taken the
     * slot — silently overwrote their booking.
     */
    @Transactional
    public void finalizeConfirmedBooking(Booking booking) {
        Slot slot = slotRepository.findByIdForUpdate(booking.getSlot().getId())
                .orElseThrow(
                        () -> new SlotUnavailableException("Slot not found with id: " + booking.getSlot().getId()));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new IllegalStateException(
                    "Only a pending booking can be confirmed; this one is " + booking.getStatus());
        }
        slotTimePolicy.assertNotStarted(slot);
        if (!isOwnedActiveHold(slot, booking.getUserId())) {
            throw new SlotUnavailableException(
                    "The hold on this slot expired before payment completed — nothing was charged");
        }

        slot.setStatus(SlotStatus.BOOKED);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);
        slotRepository.save(slot);
        events.publishEvent(SlotStatusChangedEvent.of(
                slot.getId(), slot.getVenueId(), slot.getSlotDate(), SlotStatus.BOOKED));

        booking.setStatus(BookingStatus.CONFIRMED);
        if (booking.getCancelPolicySnapshot() == null && booking.getVenueId() != null) {
            // Pin the cancellation terms the player is agreeing to right now.
            venueRepository.findById(booking.getVenueId())
                    .map(com.turfchai.venue.entity.Venue::getCancelPolicy)
                    .ifPresent(booking::setCancelPolicySnapshot);
        }
        bookingRepository.save(booking);
        announceConfirmed(booking);
    }

    /** The player's copy of the confirmation, written where the status flips. */
    private void announceConfirmed(Booking booking) {
        notificationService.sendOnce(booking.getUserId(), "BOOKING_CONFIRMED",
                "Booking confirmed · " + venueName(booking.getVenueId()),
                whenText(booking) + ". Your booking code is " + booking.getBookingCode() + ".",
                bookingLink(booking));
    }

    private String venueName(Long venueId) {
        if (venueId == null) {
            return "your turf";
        }
        return venueRepository.findById(venueId)
                .map(com.turfchai.venue.entity.Venue::getName)
                .orElse("your turf");
    }

    private String whenText(Booking booking) {
        String date = booking.getBookingDate() != null
                ? booking.getBookingDate().format(java.time.format.DateTimeFormatter.ofPattern("EEE d MMM",
                        java.util.Locale.ENGLISH))
                : "Your slot";
        if (booking.getStartTime() == null) {
            return date;
        }
        java.time.format.DateTimeFormatter time = java.time.format.DateTimeFormatter.ofPattern("h:mm a",
                java.util.Locale.ENGLISH);
        String end = booking.getEndTime() != null ? "–" + booking.getEndTime().format(time) : "";
        return date + ", " + booking.getStartTime().format(time) + end;
    }

    private String bookingLink(Booking booking) {
        return booking.getId() == null ? null : "/player/bookings/" + booking.getId();
    }

    private boolean isOwnedActiveHold(Slot slot, Long userId) {
        return slot.getStatus() == SlotStatus.HELD
                && userId != null
                && userId.equals(slot.getHeldByUserId())
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isAfter(OffsetDateTime.now());
    }

    @Transactional(readOnly = true)
    public List<Booking> listOwnerBookings(Long ownerId) {
        List<com.turfchai.venue.entity.Venue> venues = venueRepository.findByOwnerId(ownerId);
        List<Long> venueIds = venues.stream().map(com.turfchai.venue.entity.Venue::getId).toList();
        if (venueIds.isEmpty()) {
            return List.of();
        }
        return bookingRepository.findByVenueIdInOrderByCreatedAtDesc(venueIds);
    }

    @Transactional
    public void approveBooking(Long ownerId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + bookingId));
        if (!canAccess(ownerId, booking)) {
            throw new AccessDeniedException("You do not have permission to access this booking");
        }
        if (booking.getStatus() != BookingStatus.PENDING) {
            // Approving a cancelled booking used to resurrect it as CONFIRMED
            // without re-acquiring the slot, which could double-sell the time.
            throw new IllegalStateException(
                    "Only a pending booking can be approved; this one is " + booking.getStatus());
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        bookingRepository.save(booking);
        announceConfirmed(booking);
    }

    /**
     * Cancels a booking and releases its slot back to AVAILABLE. The caller
     * must be the booking owner or an admin/owner role.
     *
     * <p>
     * Cancelling is not idempotent by design: a second cancel used to run
     * the slot-release again, so re-cancelling an old booking could hand an
     * AVAILABLE status to a slot a *different* booking had since taken.
     */
    @Transactional
    public void cancelBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + bookingId));

        if (!canAccess(userId, booking)) {
            throw new AccessDeniedException("You do not have permission to cancel this booking");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new IllegalStateException("This booking is already cancelled");
        }

        // Hand the promo redemption back: a cancelled booking must not keep
        // consuming one of a limited run.
        if (booking.getPromoCode() != null && !booking.getPromoCode().isBlank()) {
            promotionService.releaseUsage(booking.getVenueId(), booking.getPromoCode());
        }

        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(booking);

        // The booking's owner is told either way, but only a cancellation they
        // did not make themselves needs to say where it came from.
        boolean cancelledByVenue = !java.util.Objects.equals(userId, booking.getUserId());
        notificationService.sendOnce(booking.getUserId(), "BOOKING_CANCELLED",
                "Booking cancelled · " + venueName(booking.getVenueId()),
                whenText(booking) + " (" + booking.getBookingCode() + ") "
                        + (cancelledByVenue ? "was cancelled by the venue." : "is cancelled."),
                bookingLink(booking));

        if (booking.getSlot() == null) {
            return;
        }
        // Take the row lock before releasing, so a concurrent hold or checkout on
        // the same slot cannot interleave with the availability flip.
        Slot slot = slotRepository.findByIdForUpdate(booking.getSlot().getId()).orElse(null);
        if (slot == null) {
            return;
        }

        // Only release the slot if nothing else live is still sitting on it.
        boolean stillClaimed = bookingRepository.findBySlotIdAndStatusNot(slot.getId(), BookingStatus.CANCELLED)
                .stream()
                .anyMatch(other -> !other.getId().equals(booking.getId()));
        if (stillClaimed) {
            return;
        }

        slot.setStatus(SlotStatus.AVAILABLE);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);
        slotRepository.save(slot);
        events.publishEvent(SlotStatusChangedEvent.of(
                slot.getId(), slot.getVenueId(), slot.getSlotDate(), SlotStatus.AVAILABLE));
    }

    /** Returns a booking only to its owner or an admin/owner role. */
    @Transactional(readOnly = true)
    public Booking getBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + bookingId));
        if (!canAccess(userId, booking)) {
            // Same exception as "missing" on purpose: the two must not be
            // distinguishable, or the id space becomes enumerable.
            throw new BookingNotFoundException("Booking not found with id: " + bookingId);
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
                .venueAddress(venue != null ? venue.getAddress() : null)
                .venueLat(venue != null ? venue.getLat() : null)
                .venueLng(venue != null ? venue.getLng() : null)
                .venueContactPhone(venue != null ? venue.getContactPhone() : null)
                .pitchId(booking.getPitchId())
                .pitchName(pitch != null ? pitch.getName() : null)
                .bookingDate(booking.getBookingDate())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .amount(booking.getGrossAmount())
                .netAmount(booking.getNetAmount())
                .promoCode(booking.getPromoCode())
                .discountAmount(booking.getDiscountAmount())
                .checkedInAt(booking.getCheckedInAt())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }

    /**
     * True when the caller may read or act on this booking.
     *
     * <p>
     * Players see only their own. Admins see everything. An owner sees only
     * bookings made at a venue they actually own — granting every owner access to
     * every booking would have let one venue read, cancel and refund another
     * venue's takings.
     */
    private boolean canAccess(Long userId, Booking booking) {
        if (userId != null && userId.equals(booking.getUserId())) {
            return true;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AccessDeniedException("You do not have permission to access this booking"));
        RoleType role = user.getRole();
        if (role == RoleType.ADMIN || role == RoleType.SUPER_ADMIN) {
            return true;
        }
        if (role != RoleType.OWNER || booking.getVenueId() == null) {
            return false;
        }
        return venueRepository.findById(booking.getVenueId())
                .map(venue -> venue.getOwner() != null && userId.equals(venue.getOwner().getId()))
                .orElse(false);
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
