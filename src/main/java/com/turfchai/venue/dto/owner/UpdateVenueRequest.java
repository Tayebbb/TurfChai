package com.turfchai.venue.dto.owner;

import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Payload for PUT /api/v1/owner/venues/{id} — all fields nullable (partial update). */
public record UpdateVenueRequest(

        @Size(max = 120)
        String name,

        @Size(max = 255)
        String address,

        @Size(max = 100)
        String area,

        BigDecimal lat,
        BigDecimal lng,

        /** "HH:mm" */
        String openTime,

        /** "HH:mm" */
        String closeTime,

        String amenities,
        String contactPhone,
        String contactEmail,
        String depositPolicy,
        String cancelPolicy,
        Boolean allowSplitPayment,
        String rules,

        /** 'DRAFT' | 'PENDING_LISTING' | 'LIVE' | 'SUSPENDED' */
        String status,

        Boolean hasPromotion,
        String promotionLabel,

        List<String> photos,
        Boolean mlPricingEnabled,
        BigDecimal basePrice
) {}
