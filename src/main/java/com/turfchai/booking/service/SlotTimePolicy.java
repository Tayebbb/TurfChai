package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.exception.SlotUnavailableException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * The single authority on whether a slot is still in the future.
 *
 * <p>Both booking paths ({@code POST /api/v1/bookings} and
 * {@code POST /api/v1/payments/checkout}) and the read-side availability grid
 * ask this class, so they cannot drift apart and let the UI offer a time the
 * booking engine would refuse — or worse, accept.
 *
 * <p>Slot times are stored as a {@link LocalDate} plus a {@link LocalTime} with
 * no zone, so they are interpreted in the server's zone. That is correct for a
 * single-region product: a 19:00 slot means 19:00 at the venue.
 */
@Component
public class SlotTimePolicy {

    /**
     * How far ahead slots may be materialised on demand. Without a ceiling a
     * crawler walking {@code ?date=} forever would grow the slot table without
     * bound; 180 days is far beyond the 7-day strip the UI actually offers.
     */
    public static final int MAX_GENERATION_DAYS_AHEAD = 180;

    private final Clock clock;

    public SlotTimePolicy() {
        this(Clock.systemDefaultZone());
    }

    SlotTimePolicy(Clock clock) {
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    /** True once the slot's start time is reached — booking closes at kick-off, not at the end. */
    public boolean hasStarted(LocalDate slotDate, LocalTime startTime) {
        if (slotDate == null || startTime == null) {
            return false;
        }
        return !slotDate.atTime(startTime).isAfter(LocalDateTime.now(clock));
    }

    public boolean hasStarted(Slot slot) {
        return slot != null && hasStarted(slot.getSlotDate(), slot.getStartTime());
    }

    /** A slot may only be sold while it is still in the future. */
    public void assertNotStarted(Slot slot) {
        if (hasStarted(slot)) {
            throw new SlotUnavailableException("This slot has already started and can no longer be booked");
        }
    }

    /**
     * Whether slots may be created for this date. Past dates are never
     * generated — doing so is what made already-elapsed times appear bookable.
     */
    public boolean mayGenerateFor(LocalDate date) {
        if (date == null) {
            return false;
        }
        LocalDate today = today();
        return !date.isBefore(today) && !date.isAfter(today.plusDays(MAX_GENERATION_DAYS_AHEAD));
    }
}
