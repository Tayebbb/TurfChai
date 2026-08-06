package com.turfchai.venue.dto.owner;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Payload for POST /api/v1/owner/venues — create a new venue. */
public record CreateVenueRequest(

        @NotBlank @Size(max = 120)
        String name,

        @NotBlank @Size(max = 255)
        String address,

        @NotBlank @Size(max = 100)
        String area,

        BigDecimal lat,
        BigDecimal lng,

        /** "HH:mm" — daily open time, e.g. "06:00" */
        @NotBlank
        String openTime,

        /** "HH:mm" — daily close time, e.g. "23:00" */
        @NotBlank
        String closeTime,

        /** Comma-separated amenity keys e.g. "floodlights,parking" */
        String amenities,

        String contactPhone,
        String contactEmail,

        /** 'FULL_ONLY' | 'THIRTY_PERCENT' | 'FIFTY_PERCENT' */
        String depositPolicy,

        /** 'FREE_24H_50_6H' | 'FLEXIBLE_6H' | 'STRICT_NO_REFUND' */
        String cancelPolicy,

        Boolean allowSplitPayment,

        /** Free-text house rules shown on booking page */
        String rules,

        /** Photo URLs (Cloudinary) */
        List<String> photos
) {}
