package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.analytics.DashboardStatsDto;
import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.service.AdminAnalyticsService;
import com.turfchai.service.AdminDemoDataSeeder;
import org.springframework.http.ResponseEntity;
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
 *   <li>{@code POST /api/v1/admin/analytics/seed}    — trigger demo data seeder</li>
 * </ul>
 */

@RestController
@RequestMapping("/api/v1/admin/analytics")
@CrossOrigin(originPatterns = "*")
public class AdminAnalyticsRestController {

    private final AdminAnalyticsService analyticsService;
    private final AdminDemoDataSeeder seeder;

    public AdminAnalyticsRestController(AdminAnalyticsService analyticsService, AdminDemoDataSeeder seeder) {
        this.analyticsService = analyticsService;
        this.seeder = seeder;
    }

    @PostMapping("/seed")
    public ResponseEntity<ApiResponse<String>> seedData(@RequestParam(required = false, defaultValue = "true") boolean force) {
        seeder.seed(force);
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
