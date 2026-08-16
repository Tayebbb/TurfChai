package com.turfchai.dto.response;

import com.turfchai.domain.Review;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * A published review as any visitor may see it on a venue page.
 *
 * <p>
 * Deliberately narrower than {@link ReviewResponse}: no booking id and no
 * author identifiers, because this is served on a public endpoint. The author
 * is reduced to a display name and initials.
 */
public record PublicReviewResponse(
        Long id,
        String authorName,
        String authorInitials,
        Integer overallRating,
        Map<String, Integer> subRatings,
        String comment,
        List<String> tags,
        ZonedDateTime createdAt,
        String ownerResponse,
        ZonedDateTime ownerRespondedAt) {

    public static PublicReviewResponse from(Review review) {
        if (review == null) {
            return null;
        }
        String name = review.getUser() != null && review.getUser().getFullName() != null
                && !review.getUser().getFullName().isBlank()
                        ? review.getUser().getFullName()
                        : "TurfChai player";
        return new PublicReviewResponse(
                review.getId(),
                name,
                initialsOf(name),
                review.getOverallRating(),
                review.getSubRatings(),
                review.getComment(),
                review.getTags(),
                review.getCreatedAt(),
                review.getOwnerResponse(),
                review.getOwnerRespondedAt());
    }

    private static String initialsOf(String name) {
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        }
        return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
}
