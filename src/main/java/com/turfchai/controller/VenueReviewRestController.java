package com.turfchai.controller;

import com.turfchai.dto.response.PublicReviewResponse;
import com.turfchai.exception.VenueNotFoundException;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Published reviews for a venue.
 *
 * <p>The venue page already showed a rating and a review count but had no way
 * to read the reviews themselves, so the UI rendered one hardcoded review for
 * every venue. This serves the real ones.
 */
@RestController
@RequestMapping("/api/v1/venues")
@RequiredArgsConstructor
public class VenueReviewRestController {

    private static final int MAX_PAGE_SIZE = 50;

    private final VenueRepository venueRepository;
    private final ReviewRepository reviewRepository;

    @GetMapping("/{slug}/reviews")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> listReviews(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Venue venue = venueRepository.findBySlug(slug)
                .orElseThrow(() -> new VenueNotFoundException("Venue not found: " + slug));

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        List<PublicReviewResponse> items = reviewRepository
                .findPublishedForVenue(venue.getId(), PageRequest.of(safePage, safeSize))
                .stream()
                .map(PublicReviewResponse::from)
                .toList();

        Integer total = reviewRepository.getReviewCountForVenue(venue.getId());
        int totalItems = total != null ? total : 0;

        return ResponseEntity.ok(Map.of(
                "items", items,
                "page", safePage,
                "size", safeSize,
                "totalItems", totalItems,
                "hasMore", (long) (safePage + 1) * safeSize < totalItems));
    }
}
