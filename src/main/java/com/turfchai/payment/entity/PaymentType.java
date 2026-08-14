package com.turfchai.payment.entity;

/** Matches the {@code ck_payments_type} check constraint on {@code payments}. */
public enum PaymentType {
    BOOKING,
    SPLIT_SHARE,
    OPEN_GAME,
    TOURNAMENT_DEPOSIT,
    TOURNAMENT_BALANCE,
    REFUND,
    WALLET
}
