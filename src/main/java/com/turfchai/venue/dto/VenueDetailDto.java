package com.turfchai.venue.dto;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/** Full venue payload for the venue detail page. */
public record VenueDetailDto(
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
        List<String> photos,
        List<String> rules,
        /** e.g. {@code FREE_24H_50_6H} — the ladder the refund engine actually applies. */
        String cancelPolicy,
        String status,
        BigDecimal basePrice,
        String contactPhone,
        String contactEmail,
        LocalTime openTime,
        LocalTime closeTime,
        List<PitchDto> pitches,
        List<PricingRuleDto> pricing) {

    public record PitchDto(
            Long id,
            String name,
            String format,
            String surfaceType,
            String lighting,
            int maxPlayers,
            boolean indoor,
            List<String> sports) {
    }

    public record PricingRuleDto(
            String sport,
            String windowType,
            BigDecimal rate,
            int slotDurationMin,
            LocalTime windowStart,
            LocalTime windowEnd) {
    }
}
