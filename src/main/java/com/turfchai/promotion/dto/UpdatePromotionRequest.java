package com.turfchai.promotion.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Payload for PATCH /api/v1/owner/venues/{venueId}/promotions/{id}.
 *
 * <p>
 * Every field is optional; only the ones present are applied, so pausing a
 * promotion is {@code {"active": false}} and nothing else is disturbed. The
 * code
 * itself is not editable — it may already be printed on a campaign.
 */
public record UpdatePromotionRequest(

                Boolean active,

                @Size(max = 120) String label,

                @Pattern(regexp = "PERCENT|FLAT") String discountType,

                @DecimalMin("0") BigDecimal discountValue,

                @DecimalMin("0") BigDecimal minOrderAmount,

                @DecimalMin("0") BigDecimal maxDiscountAmount,

                Instant validFrom,
                Instant validUntil,
                Integer usageLimit) {
}
