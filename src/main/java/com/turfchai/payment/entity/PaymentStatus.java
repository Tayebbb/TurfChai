package com.turfchai.payment.entity;

/** Matches the {@code ck_payments_status} check constraint on {@code payments}. */
public enum PaymentStatus {
    INITIATED,
    PENDING,
    SUCCESS,
    FAILED,
    REFUNDED,
    REVERSED
}
