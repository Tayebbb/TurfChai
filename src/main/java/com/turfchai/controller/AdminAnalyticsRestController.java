package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.analytics.GrowthDto;
import com.turfchai.dto.analytics.RevenueDto;
import com.turfchai.dto.analytics.SegmentsDto;
import com.turfchai.service.AdminAnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin analytics REST endpoints.
 *
 * <ul>
 *   <li>{@code GET /api/v1/admin/analytics/growth}   — user growth KPIs + signup chart</li>
 *   <li>{@code GET /api/v1/admin/analytics/revenue}  — GMV + booking count time-series</li>
 *   <li>{@code GET /api/v1/admin/analytics/segments} — user segment breakdown</li>
 * </ul>
 *
 * <p>These endpoints are consumed by the Admin Dashboard, UserGrowthPage, and
 * UserSegmentsPage frontend components.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/analytics")
@CrossOrigin(origins = "*") // For local Vite frontend
public class AdminAnalyticsRestController {

    private final AdminAnalyticsService analyticsService;

    public AdminAnalyticsRestController(AdminAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /**
     * Returns user growth KPIs and a 7-day daily signup series.
     * Consumed by {@code UserGrowthPage} to render the signup chart and KPI cards.
     */
    @GetMapping("/growth")
    public ResponseEntity<ApiResponse<GrowthDto>> getGrowth() {
        GrowthDto dto = analyticsService.getGrowth();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    /**
     * Returns monthly GMV and booking-count arrays for the Admin Dashboard
     * earnings chart.
     */
    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<RevenueDto>> getRevenue() {
        RevenueDto dto = analyticsService.getRevenue();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    /**
     * Returns user segment breakdown for the UserSegmentsPage donut chart
     * and KPI stat cards.
     */
    @GetMapping("/segments")
    public ResponseEntity<ApiResponse<SegmentsDto>> getSegments() {
        SegmentsDto dto = analyticsService.getSegments();
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }
}
