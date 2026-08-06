package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.domain.Review;
import com.turfchai.dto.ReviewDto;
import com.turfchai.exception.ReviewAlreadyExistsException;
import com.turfchai.model.User;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private VenueRepository venueRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private ReviewService reviewService;

    private User user;
    private Venue venue;
    private Booking booking;
    private ReviewDto dto;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);

        venue = new Venue();
        venue.setId(1L);
        venue.setRatingAvg(BigDecimal.ZERO);
        venue.setReviewCount(0);

        booking = new Booking();
        booking.setId(1L);
        booking.setUserId(1L);
        booking.setVenueId(1L);
        booking.setCheckedInAt(OffsetDateTime.now());

        dto = new ReviewDto();
        dto.setBookingId(1L);
        dto.setUserId(1L);
        dto.setVenueId(1L);
        dto.setOverallRating(4);
    }

    @Test
    void submitReview_successfulAndCalculatesAverage() {
        when(reviewRepository.existsByBookingIdAndUserId(1L, 1L)).thenReturn(false);
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(venueRepository.findById(1L)).thenReturn(Optional.of(venue));

        when(reviewRepository.save(any(Review.class))).thenAnswer(i -> i.getArguments()[0]);
        when(reviewRepository.getAverageRatingForVenue(1L)).thenReturn(new BigDecimal("4.5"));
        when(reviewRepository.getReviewCountForVenue(1L)).thenReturn(2);

        Review saved = reviewService.submitReview(dto);

        assertNotNull(saved);
        assertEquals(4, saved.getOverallRating());

        verify(venueRepository).save(venue);
        assertEquals(new BigDecimal("4.5"), venue.getRatingAvg());
        assertEquals(2, venue.getReviewCount());
    }

    @Test
    void submitReview_throwsExceptionIfDuplicate() {
        when(reviewRepository.existsByBookingIdAndUserId(1L, 1L)).thenReturn(true);

        ReviewAlreadyExistsException ex = assertThrows(ReviewAlreadyExistsException.class, () -> {
            reviewService.submitReview(dto);
        });
        assertEquals("A review has already been submitted for this booking.", ex.getMessage());

        verify(reviewRepository, never()).save(any());
        verify(venueRepository, never()).save(any());
    }

    @Test
    void checkIn_updatesCheckedInAtAndPersists() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        reviewService.checkIn(1L);

        assertNotNull(booking.getCheckedInAt(),
                "checkedInAt should be set after check-in");
        verify(bookingRepository).save(booking);
    }
}
