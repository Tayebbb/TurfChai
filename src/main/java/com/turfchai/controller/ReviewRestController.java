package com.turfchai.controller;

import com.turfchai.domain.Review;
import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.ReviewDto;
import com.turfchai.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for player review submission and matchday check-in.
 * <p>
 * Error handling is delegated to {@link com.turfchai.exception.GlobalExceptionHandler};
 * this controller only handles the happy path.
 * </p>
 *
 * <ul>
 *   <li>{@code POST /api/v1/reviews}           — submit a post-booking venue review</li>
 *   <li>{@code POST /api/v1/matchday/checkin}  — record a player check-in at the venue</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(originPatterns = "*") // For local Vite frontend
public class ReviewRestController {

    private final ReviewService reviewService;

    public ReviewRestController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /**
     * Submit a verified booking review.
     * <p>
     * Validates the request body via Jakarta Validation before delegating to
     * {@link ReviewService#submitReview(ReviewDto)}.
     * </p>
     *
     * @param reviewDto validated review payload
     * @return 200 with the saved {@link Review} wrapped in {@link ApiResponse}
     */
    @PostMapping("/reviews")
    public ResponseEntity<ApiResponse<Review>> submitReview(
            @Valid @RequestBody ReviewDto reviewDto) {

        Review saved = reviewService.submitReview(reviewDto);
        return ResponseEntity.ok(ApiResponse.ok(saved, "Review submitted successfully"));
    }

    /**
     * Record the player's physical check-in for a booking.
     * Sets {@code bookings.checked_in_at} to the current timestamp.
     *
     * @param bookingId the booking being checked into
     * @return 200 with a confirmation message
     */
    @PostMapping("/matchday/checkin")
    public ResponseEntity<ApiResponse<Void>> checkIn(
            @RequestParam("bookingId") Long bookingId) {

        reviewService.checkIn(bookingId);
        return ResponseEntity.ok(ApiResponse.ok("Checked in successfully"));
    }
}
