package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.domain.Review;
import com.turfchai.domain.ReviewStatus;
import com.turfchai.model.User;
import com.turfchai.venue.entity.Venue;
import com.turfchai.dto.ReviewDto;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.repository.VenueRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final VenueRepository venueRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    public ReviewService(ReviewRepository reviewRepository,
            VenueRepository venueRepository,
            UserRepository userRepository,
            BookingRepository bookingRepository) {
        this.reviewRepository = reviewRepository;
        this.venueRepository = venueRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public Review submitReview(ReviewDto dto) {
        if (reviewRepository.existsByBookingIdAndUserId(dto.getBookingId(), dto.getUserId())) {
            throw new IllegalArgumentException("Review already exists for this booking and user.");
        }

        Booking booking = bookingRepository.findById(dto.getBookingId())
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Venue venue = venueRepository.findById(dto.getVenueId())
                .orElseThrow(() -> new IllegalArgumentException("Venue not found"));

        Review review = new Review();
        review.setBooking(booking);
        review.setUser(user);
        review.setVenue(venue);
        review.setOverallRating(dto.getOverallRating());
        review.setSubRatings(dto.getSubRatings());
        review.setComment(dto.getComment());
        review.setStatus(ReviewStatus.published); // assuming auto-publish for now

        List<String> tags = new ArrayList<>();
        tags.add("verified_booking");
        if (dto.isParentReview()) {
            tags.add("parent");
        }
        review.setTags(tags);

        Review saved = reviewRepository.save(review);
        recalculateVenueRating(venue.getId());
        return saved;
    }

    @Transactional
    public void recalculateVenueRating(Long venueId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found"));

        BigDecimal avg = reviewRepository.getAverageRatingForVenue(venueId);
        Integer count = reviewRepository.getReviewCountForVenue(venueId);

        venue.setRatingAvg(avg != null ? avg : BigDecimal.ZERO);
        venue.setReviewCount(count != null ? count : 0);
        venueRepository.save(venue);
    }

    @Transactional
    public void checkIn(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        booking.setCheckedInAt(OffsetDateTime.now());
        bookingRepository.save(booking);
    }
}
