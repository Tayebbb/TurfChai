package com.turfchai.controller;

import com.turfchai.security.UserPrincipal;
import com.turfchai.service.OwnerReviewService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    /** Publishes the owner's public reply; it is then shown under the review on the venue page. */
    @PostMapping("/{id}/response")
    public ResponseEntity<Map<String, Object>> respond(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody ReviewResponseRequest request) {

        return ResponseEntity.ok(ownerReviewService.respond(principal.getId(), id, request.response()));
    }

    public record ReviewResponseRequest(
            @NotBlank(message = "Response cannot be empty")
            @Size(max = 2000, message = "Response cannot exceed 2000 characters")
            String response) {
    }
}
