package com.turfchai.service;

import com.turfchai.dto.analytics.AcquisitionChannelDto;
import com.turfchai.dto.analytics.CohortDto;
import com.turfchai.dto.analytics.DashboardStatsDto;
import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.HostStatusRowDto;
import com.turfchai.dto.analytics.PlayerTierDto;
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
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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

        // Retention rate: users who booked in both the last 30 days and the 30 days before that.
        // Null, not zero, when there is no prior cohort: "0% retention" and "nothing
        // to measure yet" are different statements and the screen renders them differently.
        Double retentionRate = null;
        List<Booking> confirmedBookings = bookingRepository.findAll()
                .stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .toList();

        OffsetDateTime currentStart = now.minusDays(30);
        OffsetDateTime priorStart = now.minusDays(60);

        Set<Long> priorBookers = new HashSet<>();
        Set<Long> currentBookers = new HashSet<>();

        for (Booking b : confirmedBookings) {
            if (b.getCreatedAt().isAfter(priorStart) && b.getCreatedAt().isBefore(currentStart)) {
                priorBookers.add(b.getUserId());
            }
            if (b.getCreatedAt().isAfter(currentStart) && b.getCreatedAt().isBefore(now)) {
                currentBookers.add(b.getUserId());
            }
        }

        if (!priorBookers.isEmpty()) {
            Set<Long> retained = new HashSet<>(priorBookers);
            retained.retainAll(currentBookers);
            retentionRate = Math.round((retained.size() * 1000.0 / priorBookers.size())) / 10.0;
        }

        GrowthDto dto = new GrowthDto(totalUsers, newUsersToday, activeRatio, retentionRate,
                labels, counts);
        dto.setGrowthMonths(growthMonths);
        dto.setGrowthPlayers(growthPlayers);
        dto.setGrowthHosts(growthHosts);
        dto.setChannels(computeChannels(allUsers, confirmedBookings));
        return dto;
    }

    /**
     * Acquisition-channel breakdown: registered users per {@code signupChannel},
     * each with the share who placed at least one booking (conversion) and CAC
     * (untracked — rendered as "—").
     */
    private List<AcquisitionChannelDto> computeChannels(List<User> allUsers,
                                                        List<Booking> confirmedBookings) {
        Set<Long> bookers = new HashSet<>();
        for (Booking b : confirmedBookings) {
            bookers.add(b.getUserId());
        }

        Map<String, List<User>> byChannel = new HashMap<>();
        for (User u : allUsers) {
            if (u.getRole() == RoleType.ADMIN || u.getRole() == RoleType.SUPER_ADMIN) {
                continue;
            }
            String channel = u.getSignupChannel();
            if (channel == null || channel.isBlank()) {
                channel = "Other";
            }
            byChannel.computeIfAbsent(channel, k -> new ArrayList<>()).add(u);
        }

        List<AcquisitionChannelDto> channels = new ArrayList<>();
        for (Map.Entry<String, List<User>> entry : byChannel.entrySet()) {
            List<User> users = entry.getValue();
            long converted = users.stream()
                    .filter(u -> bookers.contains(u.getId()))
                    .count();
            double conversionRate = users.isEmpty() ? 0.0
                    : Math.round(converted * 1000.0 / users.size()) / 10.0;
            channels.add(new AcquisitionChannelDto(
                    slugify(entry.getKey()), entry.getKey(), users.size(), conversionRate, "—"));
        }
        channels.sort((a, b) -> Long.compare(b.newUsers(), a.newUsers()));
        return channels;
    }

    private String slugify(String value) {
        return value.toLowerCase()
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    /**
     * Returns GMV + booking-count time-series for the earnings chart.
     * Weekly: last 7 days vs prior 7 days.
     * Monthly: selected year (capped at current month for current year), vs same-period prior year.
     * Trailing/leading empty months are trimmed.
     */
    public RevenueDto getRevenue(int year, String timeframe) {
        List<Booking> allBookings = bookingRepository.findAll()
                .stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .toList();

        OffsetDateTime now = OffsetDateTime.now();
        int currentYear = now.getYear();
        int currentMonth = now.getMonthValue();

        List<String> labels = new ArrayList<>();
        List<Long> gmv = new ArrayList<>();
        List<Long> bookings = new ArrayList<>();

        long totalGmv = 0;
        long totalBookings = 0;
        long previousPeriodGmv = 0;

        if ("weekly".equalsIgnoreCase(timeframe)) {
            // Last 7 days (including today), compared with the 7 days before that
            for (int i = 6; i >= 0; i--) {
                OffsetDateTime dayStart = now.minusDays(i).toLocalDate().atStartOfDay().atOffset(now.getOffset());
                OffsetDateTime dayEnd = dayStart.plusDays(1);
                labels.add(dayStart.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH));

                long dayGmv = 0;
                long dayBookings = 0;
                for (Booking b : allBookings) {
                    if (b.getCreatedAt().isAfter(dayStart) && b.getCreatedAt().isBefore(dayEnd)) {
                        dayGmv += b.getNetAmount().longValue();
                        dayBookings++;
                    }
                }
                gmv.add(dayGmv);
                bookings.add(dayBookings);
                totalGmv += dayGmv;
                totalBookings += dayBookings;

                // Previous period: days -13..-7
                OffsetDateTime prevStart = now.minusDays(i + 7).toLocalDate().atStartOfDay().atOffset(now.getOffset());
                OffsetDateTime prevEnd = prevStart.plusDays(1);
                for (Booking b : allBookings) {
                    if (b.getCreatedAt().isAfter(prevStart) && b.getCreatedAt().isBefore(prevEnd)) {
                        previousPeriodGmv += b.getNetAmount().longValue();
                    }
                }
            }
        } else {
            // Monthly: for the selected year
            int maxMonth = (year == currentYear) ? currentMonth : 12;
            
            // First pass: collect all 12 (or maxMonth) months
            String[] allLabels = new String[maxMonth];
            long[] allGmv = new long[maxMonth];
            long[] allBookingCounts = new long[maxMonth];
            
            for (int month = 1; month <= maxMonth; month++) {
                allLabels[month - 1] = OffsetDateTime.of(year, month, 1, 0, 0, 0, 0, now.getOffset())
                        .getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                
                long monthlyGmv = 0;
                long monthlyBookings = 0;
                for (Booking b : allBookings) {
                    if (b.getCreatedAt().getYear() == year && b.getCreatedAt().getMonthValue() == month) {
                        monthlyGmv += b.getNetAmount().longValue();
                        monthlyBookings++;
                    }
                }
                allGmv[month - 1] = monthlyGmv;
                allBookingCounts[month - 1] = monthlyBookings;
                totalGmv += monthlyGmv;
                totalBookings += monthlyBookings;
            }

            // Trim leading/trailing empty months (both gmv and bookings zero)
            int first = 0;
            while (first < maxMonth && allGmv[first] == 0 && allBookingCounts[first] == 0) first++;
            int last = maxMonth - 1;
            while (last >= 0 && allGmv[last] == 0 && allBookingCounts[last] == 0) last--;
            
            if (first <= last) {
                for (int i = first; i <= last; i++) {
                    labels.add(allLabels[i]);
                    gmv.add(allGmv[i]);
                    bookings.add(allBookingCounts[i]);
                }
            }
        }

        String growth;
        if ("weekly".equalsIgnoreCase(timeframe)) {
            // Week-over-week: current 7 days vs previous 7 days
            if (previousPeriodGmv > 0) {
                double pct = ((double) totalGmv - previousPeriodGmv) / previousPeriodGmv * 100;
                growth = (pct >= 0 ? "+" : "") + String.format("%.1f", pct) + "%";
            } else if (totalGmv > 0) {
                growth = "+100%";
            } else {
                growth = "+0.0%";
            }
        } else {
            // Monthly: last month vs the month before it in the returned series.
            // (Prior-year same-period comparison is meaningless while the dataset only
            // spans the trailing 12 months.)
            long lastMonthGmv = gmv.isEmpty() ? 0 : gmv.get(gmv.size() - 1);
            long prevMonthGmv = gmv.size() >= 2 ? gmv.get(gmv.size() - 2) : 0;
            if (prevMonthGmv > 0) {
                double pct = ((double) lastMonthGmv - prevMonthGmv) / prevMonthGmv * 100;
                growth = (pct >= 0 ? "+" : "") + String.format("%.1f", pct) + "%";
            } else if (lastMonthGmv > 0) {
                growth = "+100%";
            } else {
                growth = "+0.0%";
            }
        }

        return new RevenueDto(labels, gmv, bookings, growth, totalGmv, totalBookings);
    }

    /**
     * Returns user-segment KPIs (player count, host count, inactive count, LTV)
     * plus deep-dive breakdowns: player usage tiers, host lifecycle status and
     * engagement cohorts.
     */
    public SegmentsDto getSegments() {
        long totalUsers = analyticsRepository.countTotalUsers();

        long players = analyticsRepository.countActivePlayers();
        long hosts = analyticsRepository.countActiveHosts();
        long inactive = analyticsRepository.countInactiveUsers();

        long totalRevenue = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .mapToLong(b -> b.getNetAmount() != null ? b.getNetAmount().longValue() : 0L)
                .sum();
        long avgLtv = totalUsers == 0 ? 0 : totalRevenue / totalUsers;

        SegmentsDto dto = new SegmentsDto(players, hosts, inactive, totalUsers, avgLtv);

        List<User> allUsers = analyticsRepository.findAll();
        List<Booking> confirmed = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .toList();
        List<Venue> venues = venueRepository.findAll();

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime last30 = now.minusDays(30);
        OffsetDateTime prior30 = now.minusDays(60);
        OffsetDateTime new14 = now.minusDays(14);

        // ── Per-user booking aggregates ────────────────────────────────────
        Map<Long, Long> recentCounts = new HashMap<>();
        Map<Long, Long> lifetimeCounts = new HashMap<>();
        Map<Long, BigDecimal> recentSpend = new HashMap<>();
        Map<Long, BigDecimal> lifetimeSpend = new HashMap<>();
        Set<Long> activeLast30 = new HashSet<>();
        Set<Long> activePrior30 = new HashSet<>();

        // ── Venue-owner mapping + per-owner aggregates ─────────────────────
        Map<Long, Long> venueOwner = new HashMap<>();
        for (Venue v : venues) {
            if (v.getOwner() != null) {
                venueOwner.put(v.getId(), v.getOwner().getId());
            }
        }
        Map<Long, BigDecimal> ownerRevenue30 = new HashMap<>();
        Map<Long, BigDecimal> ownerLifetimeRevenue = new HashMap<>();
        Map<Long, Long> ownerBookings30 = new HashMap<>();
        Set<Long> ownerActiveLast30 = new HashSet<>();
        Set<Long> ownerActivePrior30 = new HashSet<>();

        for (Booking b : confirmed) {
            Long uid = b.getUserId();
            BigDecimal amt = b.getNetAmount() != null ? b.getNetAmount() : BigDecimal.ZERO;
            lifetimeCounts.merge(uid, 1L, Long::sum);
            lifetimeSpend.merge(uid, amt, BigDecimal::add);

            OffsetDateTime c = b.getCreatedAt();
            if (c != null && c.isAfter(last30) && c.isBefore(now)) {
                recentCounts.merge(uid, 1L, Long::sum);
                recentSpend.merge(uid, amt, BigDecimal::add);
                activeLast30.add(uid);
            } else if (c != null && c.isAfter(prior30) && c.isBefore(last30)) {
                activePrior30.add(uid);
            }

            Long owner = venueOwner.get(b.getVenueId());
            if (owner != null) {
                ownerLifetimeRevenue.merge(owner, amt, BigDecimal::add);
                if (c != null && c.isAfter(last30) && c.isBefore(now)) {
                    ownerRevenue30.merge(owner, amt, BigDecimal::add);
                    ownerBookings30.merge(owner, 1L, Long::sum);
                    ownerActiveLast30.add(owner);
                } else if (c != null && c.isAfter(prior30) && c.isBefore(last30)) {
                    ownerActivePrior30.add(owner);
                }
            }
        }

        // ── Player classification tiers ────────────────────────────────────
        List<User> activePlayers = allUsers.stream()
                .filter(this::isPlayer)
                .filter(this::isActiveStatus)
                .toList();

        List<User> powerPlayers = new ArrayList<>();
        List<User> regularPlayers = new ArrayList<>();
        List<User> newSignups = new ArrayList<>();
        for (User u : activePlayers) {
            long cnt = lifetimeCounts.getOrDefault(u.getId(), 0L);
            if (cnt >= 3) {
                powerPlayers.add(u);
            } else if (cnt >= 1) {
                regularPlayers.add(u);
            } else if (u.getCreatedAt() != null && u.getCreatedAt().isAfter(new14)) {
                newSignups.add(u);
            }
        }
        long dormantPlayers = Math.max(0, activePlayers.size()
                - powerPlayers.size() - regularPlayers.size() - newSignups.size());

        List<PlayerTierDto> tiers = new ArrayList<>();
        double playerBase = Math.max(1, activePlayers.size());
        tiers.add(new PlayerTierDto("power", "Power Players",
                "3+ confirmed bookings all-time",
                powerPlayers.size(), round1(powerPlayers.size() * 100.0 / playerBase)));
        tiers.add(new PlayerTierDto("regular", "Regular Players",
                "1-2 confirmed bookings all-time",
                regularPlayers.size(), round1(regularPlayers.size() * 100.0 / playerBase)));
        tiers.add(new PlayerTierDto("new", "New Signups",
                "Registered within the last 14 days, no bookings yet",
                newSignups.size(), round1(newSignups.size() * 100.0 / playerBase)));
        tiers.add(new PlayerTierDto("dormant", "Dormant Players",
                "No bookings all-time, registered >14 days ago",
                dormantPlayers, round1(dormantPlayers * 100.0 / playerBase)));
        dto.setPlayerTiers(tiers);

        // ── Host lifecycle status ──────────────────────────────────────────
        Map<Long, String> hostStatusByOwner = new HashMap<>();
        for (Venue v : venues) {
            if (v.getOwner() == null) {
                continue;
            }
            String venueStatus = v.getStatus() == null ? "" : v.getStatus().toUpperCase();
            String derived = "SUSPENDED".equals(venueStatus) ? "SUSPENDED"
                    : "DRAFT".equals(venueStatus) ? "PENDING"
                    : "ACTIVE";
            // Precedence: SUSPENDED > PENDING > ACTIVE
            String existing = hostStatusByOwner.get(v.getOwner().getId());
            if (existing == null || statusRank(derived) > statusRank(existing)) {
                hostStatusByOwner.put(v.getOwner().getId(), derived);
            }
        }

        List<User> hostUsers = allUsers.stream().filter(this::isHost).toList();
        Map<String, Long> statusCounts = new HashMap<>();
        Map<String, Long> statusRevenue30 = new HashMap<>();
        Map<String, List<Long>> statusMembers = new HashMap<>();
        for (User u : hostUsers) {
            // Hosts without a live venue count as "Pending" (onboarding not complete).
            String st = hostStatusByOwner.getOrDefault(u.getId(), "PENDING");
            statusCounts.merge(st, 1L, Long::sum);
            statusMembers.computeIfAbsent(st, k -> new ArrayList<>()).add(u.getId());
        }
        for (Map.Entry<String, List<Long>> entry : statusMembers.entrySet()) {
            long revenue = entry.getValue().stream()
                    .mapToLong(oid -> ownerRevenue30.getOrDefault(oid, BigDecimal.ZERO).longValue())
                    .sum();
            statusRevenue30.put(entry.getKey(), revenue);
        }

        List<HostStatusRowDto> hostStatus = new ArrayList<>();
        double hostBase = Math.max(1, hostUsers.size());
        hostStatus.add(hostRow("active", "Active", "green",
                statusCounts.getOrDefault("ACTIVE", 0L),
                statusRevenue30.getOrDefault("ACTIVE", 0L), hostBase));
        hostStatus.add(hostRow("pending", "Pending", "amber",
                statusCounts.getOrDefault("PENDING", 0L),
                statusRevenue30.getOrDefault("PENDING", 0L), hostBase));
        hostStatus.add(hostRow("suspended", "Suspended", "red",
                statusCounts.getOrDefault("SUSPENDED", 0L),
                statusRevenue30.getOrDefault("SUSPENDED", 0L), hostBase));
        dto.setHostStatus(hostStatus);

        // ── Engagement cohorts ─────────────────────────────────────────────
        List<CohortDto> cohorts = new ArrayList<>();
        cohorts.add(buildPlayerCohort("power", "Power Players", powerPlayers,
                recentCounts, recentSpend, lifetimeSpend, activePrior30));
        cohorts.add(buildPlayerCohort("regular", "Regular Players", regularPlayers,
                recentCounts, recentSpend, lifetimeSpend, activePrior30));
        cohorts.add(new CohortDto("new", "New Signups",
                newSignups.size(), 0.0, null, 0, 0));

        List<Long> activeHostIds = hostUsers.stream()
                .map(User::getId)
                .filter(id -> "ACTIVE".equals(hostStatusByOwner.getOrDefault(id, "PENDING")))
                .toList();
        cohorts.add(buildHostCohort("hosts", "Active Hosts", activeHostIds,
                ownerRevenue30, ownerLifetimeRevenue, ownerBookings30,
                ownerActiveLast30, ownerActivePrior30));
        dto.setCohorts(cohorts);

        return dto;
    }

    private boolean isPlayer(User u) {
        return u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER;
    }

    private boolean isHost(User u) {
        return u.getRole() == RoleType.HOST || u.getRole() == RoleType.OWNER;
    }

    private boolean isActiveStatus(User u) {
        return "ACTIVE".equalsIgnoreCase(u.getStatus()) && !Boolean.TRUE.equals(u.getIsSuspended());
    }

    private int statusRank(String status) {
        if ("SUSPENDED".equals(status)) return 2;
        if ("PENDING".equals(status)) return 1;
        return 0;
    }

    private HostStatusRowDto hostRow(String id, String label, String tone,
                                     long count, long revenue30, double base) {
        long avg = count == 0 ? 0 : revenue30 / count;
        return new HostStatusRowDto(id, label, tone, count, avg,
                round1(count * 100.0 / base));
    }

    private CohortDto buildPlayerCohort(String id, String name, List<User> members,
                                        Map<Long, Long> recentCounts,
                                        Map<Long, BigDecimal> recentSpend,
                                        Map<Long, BigDecimal> lifetimeSpend,
                                        Set<Long> activePrior30) {
        int n = members.size();
        if (n == 0) {
            return new CohortDto(id, name, 0, 0.0, 0.0, 0, 0);
        }
        long totalBookings = members.stream()
                .mapToLong(u -> recentCounts.getOrDefault(u.getId(), 0L)).sum();
        long returned = members.stream()
                .filter(u -> activePrior30.contains(u.getId())).count();
        long totalRecent = members.stream()
                .mapToLong(u -> recentSpend.getOrDefault(u.getId(), BigDecimal.ZERO).longValue()).sum();
        long totalLifetime = members.stream()
                .mapToLong(u -> lifetimeSpend.getOrDefault(u.getId(), BigDecimal.ZERO).longValue()).sum();
        return new CohortDto(id, name, n,
                round1(totalBookings * 1.0 / n),
                round1(returned * 100.0 / n),
                totalRecent / n,
                totalLifetime / n);
    }

    private CohortDto buildHostCohort(String id, String name, List<Long> ownerIds,
                                      Map<Long, BigDecimal> ownerRevenue30,
                                      Map<Long, BigDecimal> ownerLifetimeRevenue,
                                      Map<Long, Long> ownerBookings30,
                                      Set<Long> ownerActiveLast30,
                                      Set<Long> ownerActivePrior30) {
        int n = ownerIds.size();
        if (n == 0) {
            return new CohortDto(id, name, 0, 0.0, 0.0, 0, 0);
        }
        long totalBookings30 = ownerIds.stream()
                .mapToLong(oid -> ownerBookings30.getOrDefault(oid, 0L)).sum();
        long priorActive = ownerIds.stream()
                .filter(ownerActivePrior30::contains).count();
        long returned = ownerIds.stream()
                .filter(ownerActivePrior30::contains)
                .filter(ownerActiveLast30::contains)
                .count();
        long totalRecent = ownerIds.stream()
                .mapToLong(oid -> ownerRevenue30.getOrDefault(oid, BigDecimal.ZERO).longValue()).sum();
        long totalLifetime = ownerIds.stream()
                .mapToLong(oid -> ownerLifetimeRevenue.getOrDefault(oid, BigDecimal.ZERO).longValue()).sum();
        Double retention = priorActive == 0 ? 0.0 : round1(returned * 100.0 / priorActive);
        return new CohortDto(id, name, n,
                round1(totalBookings30 * 1.0 / n),
                retention,
                totalRecent / n,
                totalLifetime / n);
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

}
