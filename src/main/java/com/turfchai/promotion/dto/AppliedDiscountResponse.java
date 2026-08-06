package com.turfchai.promotion.dto;

import java.math.BigDecimal;

/** Result of a promo code validation — contains the discount breakdown. */
public record AppliedDiscountResponse(
        String code,
        String label,
        String discountType,
        BigDecimal discountValue,
        BigDecimal originalTotal,
        /** Discount amount in BDT */
        BigDecimal discountAmount,
        /** Final payable amount = originalTotal - discountAmount */
        BigDecimal finalTotal,
        boolean valid,
        /** Human-readable reason if invalid */
        String message
) {
    /** Convenience factory for invalid responses. */
    public static AppliedDiscountResponse invalid(String code, BigDecimal originalTotal, String reason) {
        return new AppliedDiscountResponse(code, null, null, null,
                originalTotal, BigDecimal.ZERO, originalTotal, false, reason);
    }
}
