package com.turfchai.reward.entity;

/** Matches the {@code ck_wallet_reason} check constraint on {@code wallet_transactions}. */
public enum WalletReason {
    REWARD_CREDIT,
    CHECKOUT_APPLY,
    ADJUSTMENT,
    CASHOUT
}
