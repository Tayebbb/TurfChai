package com.turfchai.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;

import java.util.Map;

/**
 * Request payload for submitting a post-booking venue review.
 * <p>
 * Bean Validation constraints are enforced by the controller via {@code @Valid}.
 * </p>
 */
public class ReviewDto {

    @NotNull(message = "bookingId is required")
    private Long bookingId;

    @NotNull(message = "userId is required")
    private Long userId;

    @NotNull(message = "venueId is required")
    private Long venueId;

    @NotNull(message = "overallRating is required")
    @Min(value = 1, message = "overallRating must be at least 1")
    @Max(value = 5, message = "overallRating must be at most 5")
    private Integer overallRating;

    /**
     * Optional sub-category ratings. Each value must be 1–5.
     * Keys: surface, lighting, cleanliness, amenities, safety, youth
     */
    private Map<String, @Valid @Min(value = 1, message = "subRatings values must be at least 1")
            @Max(value = 5, message = "subRatings values must be at most 5") Integer> subRatings;

    private String comment;

    /** When true, the review is tagged as a parent-accompanied visit. */
    private boolean parentReview;

    // ── Getters & setters ─────────────────────────────────────────────────

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getVenueId() {
        return venueId;
    }

    public void setVenueId(Long venueId) {
        this.venueId = venueId;
    }

    public Integer getOverallRating() {
        return overallRating;
    }

    public void setOverallRating(Integer overallRating) {
        this.overallRating = overallRating;
    }

    public Map<String, Integer> getSubRatings() {
        return subRatings;
    }

    public void setSubRatings(Map<String, Integer> subRatings) {
        this.subRatings = subRatings;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public boolean isParentReview() {
        return parentReview;
    }

    public void setParentReview(boolean parentReview) {
        this.parentReview = parentReview;
    }
}
