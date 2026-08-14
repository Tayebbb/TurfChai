package com.turfchai.controller;

import com.turfchai.security.UserPrincipal;
import com.turfchai.service.OwnerReviewService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/owner/reviews")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class OwnerReviewRestController {

    private final OwnerReviewService ownerReviewService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getOwnerReviews(
            @AuthenticationPrincipal UserPrincipal principal) {
        
        return ResponseEntity.ok(ownerReviewService.getReviewsSummary(principal.getId()));
    }
}
