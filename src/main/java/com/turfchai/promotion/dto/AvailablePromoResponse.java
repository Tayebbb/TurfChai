package com.turfchai.promotion.dto;

import java.math.BigDecimal;

/**
 * A promo code a player can actually use right now, for the checkout page's
 * "browse available codes" list. Deliberately narrower than {@link PromotionDto}
 * (the owner-facing shape): no id, usage count/limit, or raw conditions JSON —
 * nothing here should tell a player how close a code is to running out or let
 * them enumerate internal identifiers.
 */
public record AvailablePromoResponse(
        String code,
        String label,
        String discountType,
        BigDecimal discountValue,
        BigDecimal minOrderAmount,
        BigDecimal maxDiscountAmount) {
}
