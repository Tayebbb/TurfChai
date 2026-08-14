package com.turfchai.controller;

import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/owner/analytics")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@SecurityRequirement(name = "bearerAuth")
public class OwnerAnalyticsRestController {

    private final com.turfchai.service.OwnerAnalyticsService ownerAnalyticsService;

    public OwnerAnalyticsRestController(com.turfchai.service.OwnerAnalyticsService ownerAnalyticsService) {
        this.ownerAnalyticsService = ownerAnalyticsService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardData(
            @AuthenticationPrincipal UserPrincipal principal) {
        
        Map<String, Object> data = ownerAnalyticsService.getDashboardData(principal.getId());
        return ResponseEntity.ok(data);
    }
}
