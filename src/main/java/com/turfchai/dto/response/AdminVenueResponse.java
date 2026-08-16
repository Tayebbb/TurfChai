package com.turfchai.dto.response;

import com.turfchai.venue.entity.Venue;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;

/**
 * Admin console view of a venue. The entity's {@code owner}, {@code pitches}
 * and {@code pricingRules} are lazy associations; projecting explicitly means
 * they can never be touched after the session closes.
 */
public record AdminVenueResponse(
        Long id,
        String slug,
        String venueCode,
        Long ownerId,
        String ownerName,
        String status,
        String name,
        String address,
        String area,
        BigDecimal lat,
        BigDecimal lng,
        BigDecimal basePrice,
        boolean mlPricingEnabled,
        BigDecimal ratingAvg,
        int reviewCount,
        int savedCount,
        boolean verified,
        boolean tournamentReady,
        boolean hasPromotion,
        String promotionLabel,
        String photos,
        String amenities,
        String rules,
        LocalTime openTime,
        LocalTime closeTime,
        String depositPolicy,
        String cancelPolicy,
        boolean allowSplitPayment,
        String contactPhone,
        String contactEmail,
        Instant createdAt,
        Instant updatedAt) {

    public static AdminVenueResponse from(Venue venue) {
        if (venue == null) {
            return null;
        }
        // Safe even with a lazy proxy: this runs inside the request's transaction.
        var owner = venue.getOwner();
        return new AdminVenueResponse(
                venue.getId(),
                venue.getSlug(),
                venue.getVenueCode(),
                owner != null ? owner.getId() : null,
                owner != null ? owner.getFullName() : null,
                venue.getStatus(),
                venue.getName(),
                venue.getAddress(),
                venue.getArea(),
                venue.getLat(),
                venue.getLng(),
                venue.getBasePrice(),
                venue.isMlPricingEnabled(),
                venue.getRatingAvg(),
                venue.getReviewCount(),
                venue.getSavedCount(),
                venue.isVerified(),
                venue.isTournamentReady(),
                venue.isHasPromotion(),
                venue.getPromotionLabel(),
                venue.getPhotos(),
                venue.getAmenities(),
                venue.getRules(),
                venue.getOpenTime(),
                venue.getCloseTime(),
                venue.getDepositPolicy(),
                venue.getCancelPolicy(),
                venue.isAllowSplitPayment(),
                venue.getContactPhone(),
                venue.getContactEmail(),
                venue.getCreatedAt(),
                venue.getUpdatedAt());
    }
}
