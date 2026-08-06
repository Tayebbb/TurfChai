package com.turfchai.service;

import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.repository.AnalyticsRepository;
import com.turfchai.booking.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AdminAnalyticsService}.
 *
 * <p>
 * Tests cover:
 * </p>
 * <ul>
 * <li>Seed-data fallback when the database is below the threshold</li>
 * <li>Live-data path when the repository returns real counts</li>
 * <li>Active-ratio calculation correctness</li>
 * <li>Revenue always returns a non-empty series (demo data)</li>
 * <li>Segment counts are forwarded from the repository</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class AdminAnalyticsServiceTest {

    @Mock
    private AnalyticsRepository analyticsRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private AdminAnalyticsService analyticsService;

    // ── Growth tests ───────────────────────────────────────────────────────

    @Test
    void getGrowth_returnsZeroData_whenDatabaseIsEmpty() {
        when(analyticsRepository.countTotalUsers()).thenReturn(0L);

        GrowthDto dto = analyticsService.getGrowth();

        assertNotNull(dto);
        assertEquals(0L, dto.getTotalUsers(),
                "Seed total should be 0");
        assertEquals(7, dto.getSignupLabels().size(),
                "Should return 7-day signup series");
        assertEquals(7, dto.getSignupCounts().size());
        assertEquals(0.0, dto.getActiveRatio(), "Seed active ratio should be 0.0");

        // Repository growth queries WILL be called now when below threshold
        verify(analyticsRepository, atLeastOnce()).countNewUsersInPeriod(any(), any());
    }

    @Test
    void getGrowth_returnsLiveData_whenDatabaseHasUsers() {
        when(analyticsRepository.countTotalUsers()).thenReturn(200L);
        when(analyticsRepository.countActiveUsers()).thenReturn(180L);
        when(analyticsRepository.countNewUsersInPeriod(any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(5L);

        GrowthDto dto = analyticsService.getGrowth();

        assertEquals(200L, dto.getTotalUsers());
        // active ratio = 180/200 = 90.0%
        assertEquals(90.0, dto.getActiveRatio(), 0.1,
                "Active ratio should be 90% for 180/200 active");
        assertEquals(7, dto.getSignupLabels().size());
    }

    @Test
    void getGrowth_activeRatioCalculation_isCorrect() {
        when(analyticsRepository.countTotalUsers()).thenReturn(1000L);
        when(analyticsRepository.countActiveUsers()).thenReturn(874L);
        when(analyticsRepository.countNewUsersInPeriod(any(), any())).thenReturn(0L);

        GrowthDto dto = analyticsService.getGrowth();

        // 874/1000 = 87.4%
        assertEquals(87.4, dto.getActiveRatio(), 0.1);
    }

    // ── Revenue tests ──────────────────────────────────────────────────────

    @Test
    void getRevenue_alwaysReturnsTwelveMonthSeries() {
        when(bookingRepository.findAll()).thenReturn(Collections.emptyList());
        RevenueDto dto = analyticsService.getRevenue(2026, "monthly");

        assertNotNull(dto);
        assertEquals(12, dto.getLabels().size());
        assertEquals(12, dto.getGmv().size());
        assertEquals(12, dto.getBookings().size());
        assertEquals(0, dto.getTotalGmv(), "Total GMV should be 0 when empty");
        assertEquals(0, dto.getTotalBookings(), "Total bookings should be 0 when empty");
        assertNotNull(dto.getGrowthPercent());
    }

    @Test
    void getRevenue_totalGmv_matchesSumOfSeries() {
        when(bookingRepository.findAll()).thenReturn(Collections.emptyList());
        RevenueDto dto = analyticsService.getRevenue(2026, "monthly");

        long expectedSum = dto.getGmv().stream()
                .mapToLong(value -> Objects.requireNonNull(value).longValue())
                .sum();
        assertEquals(expectedSum, dto.getTotalGmv());
    }

    // ── Segments tests ─────────────────────────────────────────────────────

    @Test
    void getSegments_returnsZeroData_whenDatabaseIsEmpty() {
        when(analyticsRepository.countTotalUsers()).thenReturn(0L);

        SegmentsDto dto = analyticsService.getSegments();

        assertNotNull(dto);
        assertEquals(0L, dto.getPlayerCount());
        assertEquals(0L, dto.getHostCount());
        assertEquals(0L, dto.getAvgLifetimeValueBdt());
    }

    @Test
    void getSegments_returnsLiveData_whenDatabaseHasUsers() {
        when(analyticsRepository.countTotalUsers()).thenReturn(500L);
        when(analyticsRepository.countActivePlayers()).thenReturn(400L);
        when(analyticsRepository.countActiveHosts()).thenReturn(50L);
        when(analyticsRepository.countInactiveUsers()).thenReturn(30L);

        SegmentsDto dto = analyticsService.getSegments();

        assertEquals(400L, dto.getPlayerCount());
        assertEquals(50L, dto.getHostCount());
        assertEquals(30L, dto.getInactiveCount());
        assertEquals(500L, dto.getTotalUsers());
    }
}
