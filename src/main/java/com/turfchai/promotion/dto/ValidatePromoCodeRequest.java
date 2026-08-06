package com.turfchai.promotion.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Payload for POST /api/v1/promotions/validate-code (public checkout endpoint) */
public record ValidatePromoCodeRequest(

        @NotBlank
        String code,

        @NotNull @DecimalMin("0")
        BigDecimal orderTotal,

        /** Optional: venue id to scope validation */
        Long venueId
) {}
