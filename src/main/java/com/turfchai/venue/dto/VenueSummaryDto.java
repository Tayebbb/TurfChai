package com.turfchai.venue.dto;

import java.math.BigDecimal;
import java.util.List;

/** Card-sized venue projection for Home/Explore lists. */
public record VenueSummaryDto(
        Long id,
        String slug,
        String name,
        String area,
        String address,
        BigDecimal lat,
        BigDecimal lng,
        BigDecimal rating,
        int reviewCount,
        boolean verified,
        String promotionLabel,
        List<String> amenities,
        List<String> sports,
        BigDecimal fromPrice,
        Integer slotDurationMin,
        Double distanceKm,
        List<String> photos) {

    public VenueSummaryDto(
            Long id,
            String slug,
            String name,
            String area,
            String address,
            BigDecimal lat,
            BigDecimal lng,
            BigDecimal rating,
            int reviewCount,
            boolean verified,
            String promotionLabel,
            List<String> amenities,
            List<String> sports,
            BigDecimal fromPrice,
            Integer slotDurationMin,
            Double distanceKm) {
        this(id, slug, name, area, address, lat, lng, rating, reviewCount, verified,
                promotionLabel, amenities, sports, fromPrice, slotDurationMin, distanceKm, List.of());
    }
}
