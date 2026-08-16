package com.turfchai.service;

import com.turfchai.domain.Review;
import com.turfchai.model.User;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerReviewServiceTest {

    @Mock
    private VenueRepository venueRepository;

    @Mock
    private ReviewRepository reviewRepository;

    private OwnerReviewService ownerReviewService;

    @BeforeEach
    void setUp() {
        ownerReviewService = new OwnerReviewService(venueRepository, reviewRepository);
    }

    @Test
    @DisplayName("getReviewsSummary returns empty summary when owner has no venues")
    void testGetReviewsSummaryNoVenues() {
        when(venueRepository.findByOwnerId(1L)).thenReturn(List.of());

        Map<String, Object> summary = ownerReviewService.getReviewsSummary(1L);

        assertEquals(0, summary.get("totalReviews"));
        assertEquals("0.0", summary.get("averageRating"));
        assertTrue(((List<?>) summary.get("items")).isEmpty());
    }

    @Test
    @DisplayName("getReviewsSummary computes accurate rating statistics for owner's reviews")
    void testGetReviewsSummaryWithReviews() {
        Venue venue = new Venue();
        venue.setId(10L);
        venue.setName("Turf Arena");
        venue.setSlug("turf-arena");

        when(venueRepository.findByOwnerId(1L)).thenReturn(List.of(venue));

        User player = new User();
        player.setFullName("Rahim Ahmed");

        Review review1 = new Review();
        review1.setId(101L);
        review1.setVenue(venue);
        review1.setUser(player);
        review1.setOverallRating(5);
        review1.setComment("Great turf!");

        Review review2 = new Review();
        review2.setId(102L);
        review2.setVenue(venue);
        review2.setUser(player);
        review2.setOverallRating(4);
        review2.setComment("Good experience.");

        when(reviewRepository.findByVenueIdInOrderByCreatedAtDesc(List.of(10L))).thenReturn(List.of(review1, review2));

        Map<String, Object> summary = ownerReviewService.getReviewsSummary(1L);

        assertEquals(2, summary.get("totalReviews"));
        assertEquals("4.5", summary.get("averageRating"));
        assertEquals("turf-arena", summary.get("venueSlug"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) summary.get("items");
        assertEquals(2, items.size());
        assertEquals("Rahim Ahmed", items.get(0).get("author"));
        assertEquals("Great turf!", items.get(0).get("text"));
        assertEquals(true, items.get(0).get("needsResponse"));
    }

    @Test
    @DisplayName("respond stores the owner's reply and clears needsResponse")
    void testRespondStoresReply() {
        User owner = new User();
        owner.setId(1L);
        Venue venue = new Venue();
        venue.setId(10L);
        venue.setOwner(owner);

        Review review = new Review();
        review.setId(101L);
        review.setVenue(venue);

        when(reviewRepository.findById(101L)).thenReturn(java.util.Optional.of(review));
        when(reviewRepository.save(review)).thenReturn(review);

        Map<String, Object> result = ownerReviewService.respond(1L, 101L, "  Thanks for playing!  ");

        assertEquals("Thanks for playing!", result.get("response"));
        assertEquals("Thanks for playing!", review.getOwnerResponse());
        assertNotNull(review.getOwnerRespondedAt());
    }

    @Test
    @DisplayName("respond refuses a review that belongs to another owner's venue")
    void testRespondRefusesForeignReview() {
        User otherOwner = new User();
        otherOwner.setId(99L);
        Venue venue = new Venue();
        venue.setId(10L);
        venue.setOwner(otherOwner);

        Review review = new Review();
        review.setId(101L);
        review.setVenue(venue);

        when(reviewRepository.findById(101L)).thenReturn(java.util.Optional.of(review));

        assertThrows(com.turfchai.exception.ReviewNotFoundException.class,
                () -> ownerReviewService.respond(1L, 101L, "Thanks!"));
        assertNull(review.getOwnerResponse());
    }

    @Test
    @DisplayName("respond rejects a blank reply")
    void testRespondRejectsBlank() {
        User owner = new User();
        owner.setId(1L);
        Venue venue = new Venue();
        venue.setId(10L);
        venue.setOwner(owner);

        Review review = new Review();
        review.setId(101L);
        review.setVenue(venue);

        when(reviewRepository.findById(101L)).thenReturn(java.util.Optional.of(review));

        assertThrows(IllegalArgumentException.class, () -> ownerReviewService.respond(1L, 101L, "   "));
    }
}
