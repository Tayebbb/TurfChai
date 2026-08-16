package com.turfchai.repository;

import com.turfchai.domain.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    boolean existsByBookingIdAndUserId(Long bookingId, Long userId);

    @Query("SELECT AVG(r.overallRating) FROM Review r WHERE r.venue.id = :venueId AND r.status = 'PUBLISHED'")
    BigDecimal getAverageRatingForVenue(@Param("venueId") Long venueId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.venue.id = :venueId AND r.status = 'PUBLISHED'")
    Integer getReviewCountForVenue(@Param("venueId") Long venueId);

    java.util.List<Review> findByVenueIdInOrderByCreatedAtDesc(java.util.List<Long> venueIds);

    long countByUserId(Long userId);

    /** Published reviews for one venue, newest first — the public venue page. */
    @Query("SELECT r FROM Review r LEFT JOIN FETCH r.user WHERE r.venue.id = :venueId AND r.status = 'PUBLISHED' ORDER BY r.createdAt DESC")
    java.util.List<Review> findPublishedForVenue(@Param("venueId") Long venueId,
            org.springframework.data.domain.Pageable pageable);
}
