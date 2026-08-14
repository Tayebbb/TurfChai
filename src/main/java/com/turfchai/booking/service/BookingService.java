package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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

    /**
     * Acquires a 5-minute hold on a slot. The row is locked with
     * PESSIMISTIC_WRITE so concurrent hold attempts serialize on the DB row.
     * An expired hold left behind by a previous user can be re-acquired.
     */
    @Transactional
    public OffsetDateTime holdSlot(Long userId, Long slotId) {
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + slotId));

        OffsetDateTime now = OffsetDateTime.now();
        boolean expiredHold = slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(now);

        if (slot.getStatus() == SlotStatus.AVAILABLE || expiredHold) {
            OffsetDateTime heldUntil = now.plusMinutes(HOLD_DURATION_MINUTES);
            slot.setStatus(SlotStatus.HELD);
            slot.setHeldByUserId(userId);
            slot.setHoldExpiresAt(heldUntil);
            slotRepository.save(slot);
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

    /** Lists bookings for all venues owned by the caller. */
    @Transactional(readOnly = true)
    public List<Booking> listOwnerBookings(Long ownerUserId) {
        return bookingRepository.findBookingsByOwnerId(ownerUserId);
    }

    /** Approves a PENDING booking for an owner's venue. */
    @Transactional
    public void approveBooking(Long ownerUserId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new SlotUnavailableException("Booking not found with id: " + bookingId));
        if (!isVenueOwner(ownerUserId, booking)) {
            throw new AccessDeniedException("You do not have permission to approve this booking");
        }
        if (booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CONFIRMED);
            bookingRepository.save(booking);
        }
    }

    private boolean isVenueOwner(Long ownerUserId, Booking booking) {
        // Simple check. Booking has venueId. We must look up Venue.owner.id.
        // But since we can't easily join here without a venueRepository dependency,
        // wait, we can just use the query or we need venueRepository.
        // Actually, it's safer to just inject venueRepository or check via the DB.
        return bookingRepository.findBookingsByOwnerId(ownerUserId).stream()
                .anyMatch(b -> b.getId().equals(booking.getId()));
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
