package com.turfchai.promotion.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

/** Payload for POST /api/v1/owner/promotions */
public record CreatePromotionRequest(

        @NotBlank @Size(max = 30)
        String code,

        @NotBlank @Size(max = 120)
        String label,

        /** 'PERCENT' or 'FLAT' */
        @NotNull @Pattern(regexp = "PERCENT|FLAT")
        String discountType,

        @NotNull @DecimalMin("0")
        BigDecimal discountValue,

        BigDecimal minOrderAmount,
        BigDecimal maxDiscountAmount,

        /**
         * Optional JSON string for conditions, e.g.:
         * {"sports":["football"],"days_of_week":[6,7]}
         */
        String conditions,

        Instant validFrom,
        Instant validUntil,
        Integer usageLimit
) {}
