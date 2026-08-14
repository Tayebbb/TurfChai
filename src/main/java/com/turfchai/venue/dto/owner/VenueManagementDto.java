package com.turfchai.venue.dto.owner;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/** Full venue representation for the owner dashboard. */
public record VenueManagementDto(
        Long id,
        String venueCode,
        String slug,
        String name,
        String status,
        String address,
        String area,
        BigDecimal lat,
        BigDecimal lng,
        LocalTime openTime,
        LocalTime closeTime,
        String amenities,
        String rules,
        String contactPhone,
        String contactEmail,
        String depositPolicy,
        String cancelPolicy,
        BigDecimal basePrice,
        boolean allowSplitPayment,
        boolean verified,
        boolean tournamentReady,
        boolean hasPromotion,
        String promotionLabel,
        boolean mlPricingEnabled,
        List<String> photos,
        List<PitchDto> pitches,
        List<PricingRuleDto> pricingRules
) {
    public record PitchDto(
            Long id,
            String name,
            String format,
            String surfaceType,
            String surfaceDetail,
            String dimensions,
            String lighting,
            int maxPlayers,
            boolean indoor,
            boolean active,
            List<String> sportSlugs
    ) {}

    public record PricingRuleDto(
            Long id,
            String sportSlug,
            String windowType,
            BigDecimal rate,
            int slotDurationMin,
            int bufferMin,
            LocalTime windowStart,
            LocalTime windowEnd,
            List<Integer> daysOfWeek,
            boolean active
    ) {}
}
