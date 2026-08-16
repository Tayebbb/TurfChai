package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.analytics.DashboardStatsDto;
import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.service.AdminAnalyticsService;
import com.turfchai.service.AdminDemoDataSeeder;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin analytics REST endpoints.
 *
 * <ul>
 *   <li>{@code GET /api/v1/admin/analytics/growth}   — user growth KPIs + signup chart</li>
 *   <li>{@code GET /api/v1/admin/analytics/revenue}  — GMV + booking count time-series</li>
 *   <li>{@code GET /api/v1/admin/analytics/segments} — user segment breakdown</li>
 *   <li>{@code POST /api/v1/admin/analytics/seed}    — trigger demo data seeder (dev/test only)</li>
 * </ul>
 */

@RestController
@RequestMapping("/api/v1/admin/analytics")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
@CrossOrigin(originPatterns = "*")
public class AdminAnalyticsRestController {

    private final AdminAnalyticsService analyticsService;
    private final ObjectProvider<AdminDemoDataSeeder> seeder;

    public AdminAnalyticsRestController(AdminAnalyticsService analyticsService,
                                        ObjectProvider<AdminDemoDataSeeder> seeder) {
        this.analyticsService = analyticsService;
        this.seeder = seeder;
    }

    /**
     * Fabricates hundreds of users, venues and bookings. Only reachable where the
     * demo seeder bean exists (dev/test/ci) — an admin must not be able to inject
     * fake accounts and money into a real database.
     */
    @PostMapping("/seed")
    public ResponseEntity<ApiResponse<String>> seedData(@RequestParam(required = false, defaultValue = "true") boolean force) {
        AdminDemoDataSeeder demoSeeder = seeder.getIfAvailable();
        if (demoSeeder == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.ok("Demo data seeding is not available on this environment."));
        }
        demoSeeder.seed(force);
        return ResponseEntity.ok(ApiResponse.ok("Demo data seeder completed successfully."));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardStatsDto>> getDashboardStats() {
        DashboardStatsDto dto = analyticsService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/growth")
    public ResponseEntity<ApiResponse<GrowthDto>> getGrowth() {
        GrowthDto dto = analyticsService.getGrowth();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<RevenueDto>> getRevenue(
            @RequestParam(required = false, defaultValue = "2026") int year,
            @RequestParam(required = false, defaultValue = "monthly") String timeframe) {
        RevenueDto dto = analyticsService.getRevenue(year, timeframe);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/segments")
    public ResponseEntity<ApiResponse<SegmentsDto>> getSegments() {
        SegmentsDto dto = analyticsService.getSegments();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }
}
