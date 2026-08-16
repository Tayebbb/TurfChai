package com.turfchai.dto.response;

import com.turfchai.domain.Review;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Response shape for a submitted review.
 *
 * <p>
 * Returned instead of the {@code Review} entity so the response cannot drag
 * the booking/user/venue object graph (and the lazy proxies behind it) into the
 * serializer, and so no field of the author or the booking is exposed beyond
 * what the reviewer already knows.
 */
public record ReviewResponse(
        Long id,
        Long bookingId,
        Long venueId,
        Integer overallRating,
        Map<String, Integer> subRatings,
        String comment,
        List<String> tags,
        String status,
        ZonedDateTime createdAt) {

    public static ReviewResponse from(Review review) {
        return new ReviewResponse(
                review.getId(),
                review.getBooking() != null ? review.getBooking().getId() : null,
                review.getVenue() != null ? review.getVenue().getId() : null,
                review.getOverallRating(),
                review.getSubRatings(),
                review.getComment(),
                review.getTags(),
                review.getStatus() != null ? review.getStatus().name() : null,
                review.getCreatedAt());
    }
}
