package com.turfchai.service;

import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.repository.AnalyticsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.ZonedDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Computes admin analytics KPIs and time-series data for the Admin Dashboard,
 * User Growth, and User Segments pages.
 *
 * <h3>Fallback / seed behaviour</h3>
 * When the H2 in-memory database is empty (total users = 0 or very low) the
 * service enriches the response with realistic static values, mirroring the
 * demo data already shown in the frontend prototype.  This keeps the charts
 * meaningful during local development without needing a populated database.
 */
@Service
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    /**
     * Threshold below which seed data is blended into the response.
     * A real deployment will always exceed this.
     */
    private static final long SEED_THRESHOLD = 10;

    private final AnalyticsRepository analyticsRepository;

    public AdminAnalyticsService(AnalyticsRepository analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Returns user growth KPIs plus a 7-day daily signup chart series.
     */
    public GrowthDto getGrowth() {
        long totalUsers = analyticsRepository.countTotalUsers();

        if (totalUsers < SEED_THRESHOLD) {
            return buildSeedGrowthDto();
        }

        long activeUsers = analyticsRepository.countActiveUsers();
        double activeRatio = totalUsers == 0 ? 0.0
                : Math.round((activeUsers * 1000.0 / totalUsers)) / 10.0;

        // Last 24 h new signups
        ZonedDateTime now = ZonedDateTime.now();
        long newUsersToday = analyticsRepository.countNewUsersInPeriod(
                now.minusDays(1), now);

        // 7-day daily signup counts (Mon → Sun or current-7-days)
        List<String> labels = new ArrayList<>();
        List<Long> counts = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            ZonedDateTime dayStart = now.minusDays(i).toLocalDate().atStartOfDay(now.getZone());
            ZonedDateTime dayEnd = dayStart.plusDays(1);
            labels.add(dayStart.getDayOfWeek()
                    .getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
            counts.add(analyticsRepository.countNewUsersInPeriod(dayStart, dayEnd));
        }

        return new GrowthDto(totalUsers, newUsersToday, activeRatio,
                84.2, // retentionRate — requires cohort analysis beyond simple counts
                labels, counts);
    }

    /**
     * Returns monthly GMV + booking-count time-series for the earnings chart.
     * <p>
     * For dev/demo purposes the revenue data is always demo data because
     * booking net_amount is not yet aggregated via JPQL in this version
     * (the bookings table lacks a full revenue model in the minimal entity).
     * The endpoint is wired and ready for a live query replacement.
     * </p>
     */
    public RevenueDto getRevenue() {
        // Realistic monthly demo data (matches the frontend prototype)
        List<String> labels = List.of("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug");
        List<Long> gmv      = List.of(3820000L, 4150000L, 4400000L, 4780000L,
                                      5100000L, 5350000L, 5600000L, 5920000L);
        List<Long> bookings = List.of(14200L, 15400L, 16100L, 17500L,
                                      18900L, 19800L, 20700L, 21900L);

        long totalGmv = gmv.stream().mapToLong(Long::longValue).sum();
        long totalBookings = bookings.stream().mapToLong(Long::longValue).sum();

        return new RevenueDto(labels, gmv, bookings, "+24.6%", totalGmv, totalBookings);
    }

    /**
     * Returns user-segment KPIs (player count, host count, inactive count, LTV).
     */
    public SegmentsDto getSegments() {
        long totalUsers = analyticsRepository.countTotalUsers();

        if (totalUsers < SEED_THRESHOLD) {
            return buildSeedSegmentsDto();
        }

        long players  = analyticsRepository.countActivePlayers();
        long hosts    = analyticsRepository.countActiveHosts();
        long inactive = analyticsRepository.countInactiveUsers();

        // avg LTV: simplified as (total bookings revenue / total users)
        // Using a placeholder since Booking entity is minimal in current sprint
        long avgLtv = totalUsers == 0 ? 0 : 4250L;

        return new SegmentsDto(players, hosts, inactive, totalUsers, avgLtv);
    }

    // ── Seed / fallback builders ────────────────────────────────────────────

    private GrowthDto buildSeedGrowthDto() {
        List<String> labels = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
        List<Long>   counts = List.of(142L, 178L, 165L, 192L, 214L, 258L, 248L);
        return new GrowthDto(41270L, 248L, 89.4, 84.2, labels, counts);
    }

    private SegmentsDto buildSeedSegmentsDto() {
        return new SegmentsDto(34200L, 4850L, 5790L, 41270L, 4250L);
    }
}
