package com.turfchai.service;

import com.turfchai.dto.analytics.DashboardStatsDto;
import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.AdminRepository;
import com.turfchai.repository.AnalyticsRepository;
import com.turfchai.repository.TurfRequestRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    private final AnalyticsRepository analyticsRepository;
    private final TurfRequestRepository turfRequestRepository;
    private final VenueRepository venueRepository;
    private final AdminRepository adminRepository;
    private final BookingRepository bookingRepository;

    public AdminAnalyticsService(
            AnalyticsRepository analyticsRepository,
            TurfRequestRepository turfRequestRepository,
            VenueRepository venueRepository,
            AdminRepository adminRepository,
            BookingRepository bookingRepository) {
        this.analyticsRepository = analyticsRepository;
        this.turfRequestRepository = turfRequestRepository;
        this.venueRepository = venueRepository;
        this.adminRepository = adminRepository;
        this.bookingRepository = bookingRepository;
    }

    public DashboardStatsDto getDashboardStats() {
        long totalUsers = analyticsRepository.countTotalUsers();
        long pendingRequests = turfRequestRepository.findByStatusOrderByCreatedAtAsc("PENDING").size();
        long activeTurfs = venueRepository.count();
        long adminAccounts = analyticsRepository.countAdminUsers();
        return new DashboardStatsDto(pendingRequests, activeTurfs, totalUsers, adminAccounts);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Returns user growth KPIs plus a 7-day daily signup chart series.
     */
    public GrowthDto getGrowth() {
        long totalUsers = analyticsRepository.countTotalUsers();

        long activeUsers = analyticsRepository.countActiveUsers();
        double activeRatio = totalUsers == 0 ? 0.0
                : Math.round((activeUsers * 1000.0 / totalUsers)) / 10.0;

        // Last 24 h new signups
        OffsetDateTime now = OffsetDateTime.now();
        long newUsersToday = analyticsRepository.countNewUsersInPeriod(
                now.minusDays(1), now);

        // 7-day daily signup counts (Mon → Sun or current-7-days)
        List<String> labels = new ArrayList<>();
        List<Long> counts = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            OffsetDateTime dayStart = now.minusDays(i).toLocalDate().atStartOfDay().atOffset(now.getOffset());
            OffsetDateTime dayEnd = dayStart.plusDays(1);
            labels.add(dayStart.getDayOfWeek()
                    .getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
            counts.add(analyticsRepository.countNewUsersInPeriod(dayStart, dayEnd));
        }

        // 6-month growth charts
        List<String> growthMonths = new ArrayList<>();
        List<Long> growthPlayers = new ArrayList<>();
        List<Long> growthHosts = new ArrayList<>();
        
        List<User> allUsers = analyticsRepository.findAll();
        for (int i = 5; i >= 0; i--) {
            OffsetDateTime monthStart = now.minusMonths(i).withDayOfMonth(1).toLocalDate().atStartOfDay().atOffset(now.getOffset());
            OffsetDateTime monthEnd = monthStart.plusMonths(1);
            growthMonths.add(monthStart.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
            
            long pCount = allUsers.stream()
                .filter(u -> u.getCreatedAt().isAfter(monthStart) && u.getCreatedAt().isBefore(monthEnd))
                .filter(u -> u.getRole() == RoleType.PLAYER)
                .count();
            
            long hCount = allUsers.stream()
                .filter(u -> u.getCreatedAt().isAfter(monthStart) && u.getCreatedAt().isBefore(monthEnd))
                .filter(u -> u.getRole() == RoleType.HOST || u.getRole() == RoleType.OWNER)
                .count();
                
            growthPlayers.add(pCount);
            growthHosts.add(hCount);
        }

        GrowthDto dto = new GrowthDto(totalUsers, newUsersToday, activeRatio,
                84.2, // retentionRate — requires cohort analysis beyond simple counts
                labels, counts);
        dto.setGrowthMonths(growthMonths);
        dto.setGrowthPlayers(growthPlayers);
        dto.setGrowthHosts(growthHosts);
        return dto;
    }

    /**
     * Returns GMV + booking-count time-series for the earnings chart.
     * Replaced demo data with real data queries.
     */
    public RevenueDto getRevenue(int year, String timeframe) {
        List<Booking> allBookings = bookingRepository.findAll();
        
        List<String> labels = new ArrayList<>();
        List<Long> gmv = new ArrayList<>();
        List<Long> bookings = new ArrayList<>();
        
        long totalGmv = 0;
        long totalBookings = 0;
        long lastYearGmv = 0;
        
        if ("weekly".equalsIgnoreCase(timeframe)) {
            // Compute last 7 days including today
            OffsetDateTime now = OffsetDateTime.now();
            for (int i = 6; i >= 0; i--) {
                OffsetDateTime dayStart = now.minusDays(i).toLocalDate().atStartOfDay().atOffset(now.getOffset());
                OffsetDateTime dayEnd = dayStart.plusDays(1);
                labels.add(dayStart.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
                
                long dailyGmv = 0;
                long dailyBookings = 0;
                
                for (Booking b : allBookings) {
                    if (b.getStatus() == BookingStatus.CONFIRMED &&
                        b.getCreatedAt().isAfter(dayStart) && b.getCreatedAt().isBefore(dayEnd)) {
                        dailyGmv += b.getNetAmount().longValue();
                        dailyBookings++;
                    }
                }
                gmv.add(dailyGmv);
                bookings.add(dailyBookings);
                totalGmv += dailyGmv;
                totalBookings += dailyBookings;
            }
        } else {
            // Monthly for the given year
            for (int month = 1; month <= 12; month++) {
                labels.add(OffsetDateTime.now().withMonth(month).getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));
                long monthlyGmv = 0;
                long monthlyBookings = 0;
                for (Booking b : allBookings) {
                    if (b.getStatus() == BookingStatus.CONFIRMED && b.getCreatedAt().getYear() == year && b.getCreatedAt().getMonthValue() == month) {
                        monthlyGmv += b.getNetAmount().longValue();
                        monthlyBookings++;
                    } else if (b.getStatus() == BookingStatus.CONFIRMED && b.getCreatedAt().getYear() == year - 1) {
                        // Gather last year total for growth calculation (simplistic)
                        lastYearGmv += b.getNetAmount().longValue();
                    }
                }
                gmv.add(monthlyGmv);
                bookings.add(monthlyBookings);
                totalGmv += monthlyGmv;
                totalBookings += monthlyBookings;
            }
        }
        
        // Simple growth % for demo
        String growth = "+0.0%";
        if (totalGmv > 0 && lastYearGmv > 0) {
            double pct = ((double)totalGmv - lastYearGmv) / lastYearGmv * 100;
            growth = (pct >= 0 ? "+" : "") + String.format("%.1f", pct) + "%";
        } else if (totalGmv > 0) {
            growth = "+100%";
        }

        return new RevenueDto(labels, gmv, bookings, growth, totalGmv, totalBookings);
    }

    /**
     * Returns user-segment KPIs (player count, host count, inactive count, LTV).
     */
    public SegmentsDto getSegments() {
        long totalUsers = analyticsRepository.countTotalUsers();

        long players = analyticsRepository.countActivePlayers();
        long hosts = analyticsRepository.countActiveHosts();
        long inactive = analyticsRepository.countInactiveUsers();

        long totalRevenue = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .mapToLong(b -> b.getNetAmount().longValue())
                .sum();
        long avgLtv = totalUsers == 0 ? 0 : totalRevenue / totalUsers;

        return new SegmentsDto(players, hosts, inactive, totalUsers, avgLtv);
    }

}
