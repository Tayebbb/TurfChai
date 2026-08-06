package com.turfchai.repository;

import com.turfchai.domain.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    boolean existsByBookingIdAndUserId(Long bookingId, Long userId);

    @Query("SELECT AVG(r.overallRating) FROM Review r WHERE r.venue.id = :venueId AND r.status = 'published'")
    BigDecimal getAverageRatingForVenue(@Param("venueId") Long venueId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.venue.id = :venueId AND r.status = 'published'")
    Integer getReviewCountForVenue(@Param("venueId") Long venueId);
}
