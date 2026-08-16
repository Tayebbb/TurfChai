package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.exception.SlotUnavailableException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TC-009 / QA-N07 regression: the clock is pinned so "has this slot started?"
 * is asserted at exact boundaries rather than against whatever time the suite
 * happens to run at.
 */
class SlotTimePolicyTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Dhaka");
    private static final LocalDate TODAY = LocalDate.of(2026, 8, 15);

    /** Fixed at 2026-08-15 19:00:00 local. */
    private SlotTimePolicy policyAt(int hour, int minute) {
        Instant instant = TODAY.atTime(hour, minute).atZone(ZONE).toInstant();
        return new SlotTimePolicy(Clock.fixed(instant, ZONE));
    }

    @Test
    void yesterdayHasStarted() {
        assertTrue(policyAt(19, 0).hasStarted(TODAY.minusDays(1), LocalTime.of(23, 0)));
    }

    @Test
    void earlierToday_hasStarted() {
        assertTrue(policyAt(19, 0).hasStarted(TODAY, LocalTime.of(18, 59)));
    }

    @Test
    void exactlyNow_countsAsStarted() {
        // Booking closes at kick-off: 19:00 is no longer sellable at 19:00.
        assertTrue(policyAt(19, 0).hasStarted(TODAY, LocalTime.of(19, 0)));
    }

    @Test
    void oneMinuteFromNow_hasNotStarted() {
        assertFalse(policyAt(19, 0).hasStarted(TODAY, LocalTime.of(19, 1)));
    }

    @Test
    void laterToday_hasNotStarted() {
        assertFalse(policyAt(19, 0).hasStarted(TODAY, LocalTime.of(20, 30)));
    }

    @Test
    void tomorrowEarlyMorning_hasNotStarted() {
        assertFalse(policyAt(23, 59).hasStarted(TODAY.plusDays(1), LocalTime.of(0, 30)));
    }

    @Test
    void justBeforeMidnight_doesNotLeakIntoTomorrow() {
        SlotTimePolicy policy = policyAt(23, 59);
        assertEquals(TODAY, policy.today());
        assertFalse(policy.hasStarted(TODAY.plusDays(1), LocalTime.of(7, 0)));
        assertTrue(policy.hasStarted(TODAY, LocalTime.of(23, 58)));
    }

    @Test
    void nullDateOrTimeIsNeverTreatedAsStarted() {
        SlotTimePolicy policy = policyAt(19, 0);
        assertFalse(policy.hasStarted(null, LocalTime.of(7, 0)));
        assertFalse(policy.hasStarted(TODAY, null));
        assertFalse(policy.hasStarted((Slot) null));
    }

    @Test
    void assertNotStarted_throwsForAnElapsedSlot() {
        Slot slot = Slot.builder()
                .slotDate(TODAY)
                .startTime(LocalTime.of(9, 30))
                .build();
        SlotUnavailableException thrown = assertThrows(SlotUnavailableException.class,
                () -> policyAt(19, 0).assertNotStarted(slot));
        assertTrue(thrown.getMessage().contains("already started"));
    }

    @Test
    void assertNotStarted_passesForAFutureSlot() {
        Slot slot = Slot.builder()
                .slotDate(TODAY.plusDays(1))
                .startTime(LocalTime.of(9, 30))
                .build();
        policyAt(19, 0).assertNotStarted(slot);
    }

    @Test
    void generationIsRefusedForPastDates() {
        SlotTimePolicy policy = policyAt(19, 0);
        assertFalse(policy.mayGenerateFor(TODAY.minusDays(1)));
        assertFalse(policy.mayGenerateFor(LocalDate.of(1999, 1, 1)));
    }

    @Test
    void generationIsAllowedFromTodayToTheHorizon() {
        SlotTimePolicy policy = policyAt(19, 0);
        assertTrue(policy.mayGenerateFor(TODAY));
        assertTrue(policy.mayGenerateFor(TODAY.plusDays(1)));
        assertTrue(policy.mayGenerateFor(TODAY.plusDays(SlotTimePolicy.MAX_GENERATION_DAYS_AHEAD)));
    }

    @Test
    void generationIsRefusedBeyondTheHorizon() {
        SlotTimePolicy policy = policyAt(19, 0);
        assertFalse(policy.mayGenerateFor(TODAY.plusDays(SlotTimePolicy.MAX_GENERATION_DAYS_AHEAD + 1)));
        assertFalse(policy.mayGenerateFor(TODAY.plusYears(5)));
        assertFalse(policy.mayGenerateFor(null));
    }
}
