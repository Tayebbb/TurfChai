package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.ReviewDto;
import com.turfchai.dto.response.ReviewResponse;
import com.turfchai.security.AuthenticatedUser;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.ReviewService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for player review submission and matchday check-in.
 *
 * <p>Both operations act on behalf of the authenticated principal only. The
 * author of a review and the actor of a check-in are never read from the
 * request payload.
 *
 * <ul>
 *   <li>{@code POST /api/v1/reviews}           — submit a post-booking venue review</li>
 *   <li>{@code POST /api/v1/matchday/checkin}  — record a player check-in at the venue</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "bearerAuth")
public class ReviewRestController {

    private final ReviewService reviewService;

    public ReviewRestController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /** Submit a verified booking review. The author is the caller. */
    @PostMapping("/reviews")
    public ResponseEntity<ApiResponse<ReviewResponse>> submitReview(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ReviewDto reviewDto) {

        Long authorId = AuthenticatedUser.requireId(principal);
        ReviewResponse saved = ReviewResponse.from(reviewService.submitReview(reviewDto, authorId));
        return ResponseEntity.ok(ApiResponse.ok(saved, "Review submitted successfully"));
    }

    /**
     * Record the caller's physical check-in for a booking they own, or a
     * gate check-in performed by venue staff.
     */
    @PostMapping("/matchday/checkin")
    public ResponseEntity<ApiResponse<Void>> checkIn(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("bookingId") Long bookingId) {

        UserPrincipal caller = AuthenticatedUser.require(principal);
        boolean staff = caller.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(role -> role.equals("ROLE_OWNER")
                        || role.equals("ROLE_ADMIN")
                        || role.equals("ROLE_SUPER_ADMIN"));

        reviewService.checkIn(bookingId, caller.getId(), staff);
        return ResponseEntity.ok(ApiResponse.ok("Checked in successfully"));
    }
}
