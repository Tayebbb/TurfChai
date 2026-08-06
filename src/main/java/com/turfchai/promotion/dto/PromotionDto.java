package com.turfchai.promotion.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** Promotion summary/detail response. */
public record PromotionDto(
        Long id,
        Long venueId,
        String code,
        String label,
        String discountType,
        BigDecimal discountValue,
        BigDecimal minOrderAmount,
        BigDecimal maxDiscountAmount,
        String conditions,
        Instant validFrom,
        Instant validUntil,
        Integer usageLimit,
        int usageCount,
        boolean active
) {}
