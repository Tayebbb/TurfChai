package com.turfchai.reward.entity;

/**
 * Matches the {@code ck_wallet_reason} check constraint on
 * {@code wallet_transactions}.
 */
public enum WalletReason {
    REWARD_CREDIT,
    CHECKOUT_APPLY,
    ADJUSTMENT,
    CASHOUT,
    /** Wallet money handed back when a booking it paid for is cancelled. */
    REFUND
}
