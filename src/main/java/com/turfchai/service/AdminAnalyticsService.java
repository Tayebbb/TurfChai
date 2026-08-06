package com.turfchai.service;

import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.repository.AnalyticsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Computes live, database-backed analytics for the admin console. */
@Service
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    private final AnalyticsRepository analyticsRepository;

    public AdminAnalyticsService(AnalyticsRepository analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    public GrowthDto getGrowth() {
        long totalUsers = analyticsRepository.countTotalUsers();
        long activeUsers = analyticsRepository.countActiveUsers();
        double activeRatio = totalUsers == 0 ? 0.0 : roundOneDecimal(activeUsers * 100.0 / totalUsers);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        List<String> labels = new ArrayList<>();
        List<Long> counts = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            OffsetDateTime start = now.minusDays(i).toLocalDate().atStartOfDay().atOffset(ZoneOffset.UTC);
            labels.add(start.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
            counts.add(analyticsRepository.countNewUsersInPeriod(start, start.plusDays(1)));
        }
        long newUsersToday = analyticsRepository.countNewUsersInPeriod(now.minusDays(1), now);
        return new GrowthDto(totalUsers, newUsersToday, activeRatio, 0.0, labels, counts);
    }

    public RevenueDto getRevenue() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        YearMonth currentMonth = YearMonth.from(now);
        YearMonth firstMonth = currentMonth.minusMonths(7);
        OffsetDateTime from = firstMonth.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        Map<YearMonth, Object[]> rowsByMonth = new HashMap<>();
        for (Object[] row : analyticsRepository.findMonthlyRevenue(from)) {
            rowsByMonth.put(toYearMonth(row[0]), row);
        }

        List<String> labels = new ArrayList<>();
        List<Long> gmv = new ArrayList<>();
        List<Long> bookings = new ArrayList<>();
        for (int offset = 0; offset < 8; offset++) {
            YearMonth month = firstMonth.plusMonths(offset);
            Object[] row = rowsByMonth.get(month);
            labels.add(month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
            gmv.add(row == null ? 0L : ((Number) row[1]).longValue());
            bookings.add(row == null ? 0L : ((Number) row[2]).longValue());
        }

        long totalGmv = gmv.stream().mapToLong(Long::longValue).sum();
        long totalBookings = bookings.stream().mapToLong(Long::longValue).sum();
        double utilization = number(analyticsRepository.calculateTurfUtilization(from, now));
        return new RevenueDto(labels, gmv, bookings, percentageChange(gmv), totalGmv, totalBookings,
                roundOneDecimal(utilization));
    }

    public SegmentsDto getSegments() {
        long totalUsers = analyticsRepository.countTotalUsers();
        long players = analyticsRepository.countActivePlayers();
        long hosts = analyticsRepository.countActiveHosts();
        long inactive = analyticsRepository.countInactiveUsers();
        BigDecimal revenue = analyticsRepository.sumBookingRevenue();
        long averageLtv = totalUsers == 0 || revenue == null ? 0L
                : revenue.divide(BigDecimal.valueOf(totalUsers), 0, java.math.RoundingMode.HALF_UP).longValue();
        return new SegmentsDto(players, hosts, inactive, totalUsers, averageLtv);
    }

    private static YearMonth toYearMonth(Object value) {
        if (value instanceof Timestamp timestamp) return YearMonth.from(timestamp.toLocalDateTime());
        if (value instanceof OffsetDateTime dateTime) return YearMonth.from(dateTime);
        if (value instanceof java.time.LocalDateTime dateTime) return YearMonth.from(dateTime);
        if (value instanceof java.time.LocalDate date) return YearMonth.from(date);
        throw new IllegalArgumentException("Unsupported analytics period type: " + value);
    }

    private static double number(Number value) { return value == null ? 0.0 : value.doubleValue(); }
    private static double roundOneDecimal(double value) { return Math.round(value * 10.0) / 10.0; }

    private static String percentageChange(List<Long> values) {
        if (values.size() < 2) return "0.0%";
        long previous = values.get(values.size() - 2);
        long latest = values.get(values.size() - 1);
        if (previous == 0) return latest == 0 ? "0.0%" : "+100.0%";
        return String.format(Locale.ROOT, "%+.1f%%", (latest - previous) * 100.0 / previous);
    }
}
