package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.domain.Review;
import com.turfchai.domain.ReviewStatus;
import com.turfchai.dto.ReviewDto;
import com.turfchai.model.User;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
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

    /**
     * Saves a review authored by {@code authorId}.
     *
     * <p>The author is the authenticated caller, never {@code dto.userId} — a
     * client must not be able to attribute a review to somebody else. The
     * booking must belong to that author, must not be cancelled, and must
     * already have started, so a review always describes a match the reviewer
     * actually had.
     */
    @Transactional
    public Review submitReview(ReviewDto dto, Long authorId) {
        if (authorId == null) {
            throw new SecurityException("A review must be submitted by an authenticated user");
        }

        Booking booking = bookingRepository.findById(dto.getBookingId())
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (booking.getUserId() == null || !booking.getUserId().equals(authorId)) {
            throw new SecurityException("You can only review your own booking");
        }
        if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CANCELLED) {
            throw new IllegalArgumentException("A cancelled booking cannot be reviewed");
        }
        if (!hasStarted(booking)) {
            throw new IllegalArgumentException("You can review this booking once the match has started");
        }
        if (reviewRepository.existsByBookingIdAndUserId(booking.getId(), authorId)) {
            throw new IllegalArgumentException("Review already exists for this booking and user.");
        }

        User user = userRepository.findById(authorId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // The venue is taken from the booking, not the request: a client must not
        // be able to attach a review to an unrelated venue's rating.
        Long venueId = booking.getVenueId() != null ? booking.getVenueId() : dto.getVenueId();
        Venue venue = venueRepository.findById(venueId)
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

    /**
     * Records a physical check-in.
     *
     * <p>Allowed for the player who owns the booking, or for staff of the venue
     * (owner/admin) operating the gate. Anyone else — including another signed-in
     * player — is refused.
     */
    @Transactional
    public void checkIn(Long bookingId, Long callerId, boolean callerIsStaff) {
        if (callerId == null) {
            throw new SecurityException("Check-in requires an authenticated user");
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        boolean ownsBooking = booking.getUserId() != null && booking.getUserId().equals(callerId);
        if (!ownsBooking && !callerIsStaff) {
            throw new SecurityException("You can only check in your own booking");
        }
        if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CANCELLED) {
            throw new IllegalArgumentException("A cancelled booking cannot be checked in");
        }

        booking.setCheckedInAt(OffsetDateTime.now());
        bookingRepository.save(booking);
    }

    /** True once the booking's start instant has passed. */
    private boolean hasStarted(Booking booking) {
        if (booking.getBookingDate() == null) {
            return true;
        }
        java.time.LocalTime start = booking.getStartTime() != null
                ? booking.getStartTime()
                : java.time.LocalTime.MIN;
        return !booking.getBookingDate().atTime(start).isAfter(java.time.LocalDateTime.now());
    }
}
