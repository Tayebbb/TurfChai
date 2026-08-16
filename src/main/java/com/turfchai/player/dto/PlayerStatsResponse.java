package com.turfchai.player.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * A player's activity summary.
 *
 * <p>Every figure is derived from records the platform already holds — bookings,
 * check-ins, reviews and open-game memberships. Nothing here is estimated: if a
 * number cannot be computed it is zero, and match results are not included
 * because TurfChai never records a score for a casual booking.
 */
public record PlayerStatsResponse(
        int totalBookings,
        int completedBookings,
        int cancelledBookings,
        int upcomingBookings,
        int checkedInCount,
        int venuesPlayed,
        int openGamesJoined,
        int reviewsWritten,
        int reliabilityScore,
        BigDecimal totalSpent,
        String favouriteVenueName,
        List<MonthlyCount> bookingsByMonth) {

    /** @param month ISO year-month, e.g. "2026-08". */
    public record MonthlyCount(String month, int bookings) {
    }
}
