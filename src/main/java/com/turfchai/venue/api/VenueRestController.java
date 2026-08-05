package com.turfchai.venue.api;

import com.turfchai.venue.dto.PagedResponse;
import com.turfchai.venue.dto.VenueDetailDto;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.service.VenueSearchCriteria;
import com.turfchai.venue.service.VenueSearchService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * Player venue discovery endpoints.
 * `/explore` is an alias of the venue search tailored for the Explore page.
 */
@RestController
@RequestMapping("/api/v1")
@Validated
public class VenueRestController {

    private final VenueSearchService venueSearchService;

    public VenueRestController(VenueSearchService venueSearchService) {
        this.venueSearchService = venueSearchService;
    }

    @GetMapping({"/venues", "/venues/explore"})
    public ResponseEntity<PagedResponse<VenueSummaryDto>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) List<String> amenity,
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) LocalTime openAt,
            @RequestParam(required = false) BigDecimal lat,
            @RequestParam(required = false) BigDecimal lng,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue = "rating") String sort) {

        VenueSearchCriteria criteria = new VenueSearchCriteria(
                q, area, sport, minPrice, maxPrice, amenity, verified, openAt, lat, lng, radiusKm);
        return ResponseEntity.ok(venueSearchService.search(criteria, page, size, sort));
    }

    @GetMapping("/venues/{slug}")
    public ResponseEntity<VenueDetailDto> bySlug(@PathVariable String slug) {
        return ResponseEntity.ok(venueSearchService.getBySlug(slug));
    }
}
