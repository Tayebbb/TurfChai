package com.turfchai.payment.service;

import org.springframework.stereotype.Service;

/**
 * Implements the three venue-selectable cancellation policies described in
 * {@code ai-knowledge/cancellation-refund-policy.md}, matching the exact
 * values allowed by {@code venues.cancel_policy}'s {@code ck_venues_cancel}
 * check constraint.
 */
@Service
public class RefundCalculatorService {

    public static final String FREE_24H_50_6H = "FREE_24H_50_6H";
    public static final String FLEXIBLE_6H = "FLEXIBLE_6H";
    public static final String STRICT_NO_REFUND = "STRICT_NO_REFUND";

    /**
     * The refund percentage (0, 50, or 100) for cancelling a booking
     * {@code hoursUntilStart} hours before its slot starts, under the given
     * venue cancellation policy. A negative {@code hoursUntilStart} (the
     * slot has already started/passed) always refunds 0.
     */
    public int calculateRefundPercent(String cancelPolicy, double hoursUntilStart) {
        if (hoursUntilStart < 0) {
            return 0;
        }
        String policy = cancelPolicy != null ? cancelPolicy : FREE_24H_50_6H;
        return switch (policy) {
            case STRICT_NO_REFUND -> 0;
            case FLEXIBLE_6H -> hoursUntilStart >= 6 ? 100 : 0;
            case FREE_24H_50_6H -> hoursUntilStart >= 24 ? 100 : hoursUntilStart >= 6 ? 50 : 0;
            default -> hoursUntilStart >= 24 ? 100 : hoursUntilStart >= 6 ? 50 : 0;
        };
    }
}
