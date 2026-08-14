package com.turfchai.reward.entity;

/** Matches the {@code ck_redemption_status} check constraint on {@code reward_redemptions}. */
public enum RedemptionStatus {
    /** Points spent, reward not yet consumed (e.g. a discount pass waiting to be applied). */
    ISSUED,
    /** Reward has been consumed — wallet credited or applied at checkout. */
    APPLIED,
    EXPIRED,
    VOIDED
}
