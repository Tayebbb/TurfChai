package com.turfchai.reward.entity;

/**
 * Matches the {@code ck_point_reason} check constraint on {@code point_ledger}.
 * Each earning reason carries the default point award described in
 * {@code ai-knowledge/loyalty-rewards.md}; redemption/adjustment/expiry reasons
 * carry no default since their delta is computed by the caller.
 */
public enum PointReason {
    BOOKING(50),
    ATTENDED_MATCH(30),
    REVIEW(20),
    PROFILE_COMPLETION(10),
    JOINED_OPEN_GAME(15),
    OFF_PEAK_BONUS(10),
    MONTHLY_BONUS(0),
    REDEMPTION(0),
    ADJUSTMENT(0),
    EXPIRY(0);

    private final int defaultPoints;

    PointReason(int defaultPoints) {
        this.defaultPoints = defaultPoints;
    }

    /** The standard number of points this reason awards, per the loyalty program spec. */
    public int defaultPoints() {
        return defaultPoints;
    }
}
