package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.domain.Review;
import com.turfchai.dto.ReviewDto;
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

        Review saved = reviewService.submitReview(dto, 1L);

        assertNotNull(saved);
        assertEquals(4, saved.getOverallRating());

        verify(venueRepository).save(venue);
        assertEquals(new BigDecimal("4.5"), venue.getRatingAvg());
        assertEquals(2, venue.getReviewCount());
    }

    @Test
    void submitReview_throwsExceptionIfDuplicate() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(reviewRepository.existsByBookingIdAndUserId(1L, 1L)).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            reviewService.submitReview(dto, 1L);
        });
        assertEquals("Review already exists for this booking and user.", ex.getMessage());

        verify(reviewRepository, never()).save(any());
        verify(venueRepository, never()).save(any());
    }

    /** TC-007: the author is the caller, never the id supplied in the payload. */
    @Test
    void submitReview_ignoresUserIdInPayload() {
        dto.setUserId(999L); // attacker claims to be somebody else
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(reviewRepository.existsByBookingIdAndUserId(1L, 1L)).thenReturn(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(venueRepository.findById(1L)).thenReturn(Optional.of(venue));
        when(reviewRepository.save(any(Review.class))).thenAnswer(i -> i.getArguments()[0]);

        Review saved = reviewService.submitReview(dto, 1L);

        assertEquals(1L, saved.getUser().getId(),
                "review must be attributed to the authenticated caller, not dto.userId");
        verify(userRepository, never()).findById(999L);
    }

    /** TC-007: a caller cannot review a booking that belongs to somebody else. */
    @Test
    void submitReview_rejectsBookingOwnedByAnotherUser() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking)); // booking.userId == 1

        assertThrows(SecurityException.class, () -> reviewService.submitReview(dto, 2L));

        verify(reviewRepository, never()).save(any());
        verify(venueRepository, never()).save(any());
    }

    @Test
    void submitReview_rejectsAnonymousAuthor() {
        assertThrows(SecurityException.class, () -> reviewService.submitReview(dto, null));
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void submitReview_rejectsCancelledBooking() {
        booking.setStatus(com.turfchai.booking.entity.BookingStatus.CANCELLED);
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class, () -> reviewService.submitReview(dto, 1L));
        verify(reviewRepository, never()).save(any());
    }

    /** A match that has not started yet cannot be reviewed. */
    @Test
    void submitReview_rejectsBookingThatHasNotStarted() {
        booking.setBookingDate(java.time.LocalDate.now().plusDays(3));
        booking.setStartTime(java.time.LocalTime.of(10, 0));
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class, () -> reviewService.submitReview(dto, 1L));
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void checkIn_updatesCheckedInAtAndPersists() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        reviewService.checkIn(1L, 1L, false);

        assertNotNull(booking.getCheckedInAt(),
                "checkedInAt should be set after check-in");
        verify(bookingRepository).save(booking);
    }

    /**
     * TC-006: another signed-in player must not be able to check in this booking.
     */
    @Test
    void checkIn_rejectsCallerWhoDoesNotOwnTheBooking() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking)); // owned by user 1

        assertThrows(SecurityException.class, () -> reviewService.checkIn(1L, 2L, false));

        assertNull(booking.getCheckedInAt());
        verify(bookingRepository, never()).save(any());
    }

    /** Venue staff run the gate, so they may check in a booking they do not own. */
    @Test
    void checkIn_allowsVenueStaff() {
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        reviewService.checkIn(1L, 2L, true);

        assertNotNull(booking.getCheckedInAt());
        verify(bookingRepository).save(booking);
    }

    @Test
    void checkIn_rejectsAnonymousCaller() {
        assertThrows(SecurityException.class, () -> reviewService.checkIn(1L, null, false));
        verify(bookingRepository, never()).save(any());
    }

    /** QA-N12: a cancelled booking has no match to attend. */
    @Test
    void checkIn_rejectsCancelledBooking() {
        booking.setStatus(com.turfchai.booking.entity.BookingStatus.CANCELLED);
        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class, () -> reviewService.checkIn(1L, 1L, false));

        assertNull(booking.getCheckedInAt());
        verify(bookingRepository, never()).save(any());
    }
}
