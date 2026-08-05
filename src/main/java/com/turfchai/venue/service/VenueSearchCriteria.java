package com.turfchai.venue.service;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/** Multi-field venue search filter. All fields optional. */
public record VenueSearchCriteria(
        String query,
        String area,
        String sport,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        List<String> amenities,
        Boolean verified,
        LocalTime openAt,
        BigDecimal nearLat,
        BigDecimal nearLng,
        Double radiusKm) {
}
