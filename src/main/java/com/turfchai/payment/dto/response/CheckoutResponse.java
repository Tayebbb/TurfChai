package com.turfchai.payment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Response for POST /api/v1/payments/checkout. Always HTTP 200 — a declined
 * payment is a normal business outcome (like a real gateway's response),
 * not an HTTP error. {@link #getStatus()} is the source of truth for
 * success/failure.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckoutResponse {
    /**
     * "SUCCESS" or "FAILED" — mirrors PaymentStatus but keeps this DTO decoupled
     * from the entity enum's full range.
     */
    private String status;
    private PaymentResponse payment;
    private Long bookingId;
    private String bookingCode;
    private BigDecimal walletApplied;
    private BigDecimal newWalletBalance;
    private Integer pointsEarned;
    /** Code redeemed for this booking, if any, and what the server priced it at. */
    private String promoCode;
    private BigDecimal discountApplied;
    private String message;
}
