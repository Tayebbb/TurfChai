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
    }
}
