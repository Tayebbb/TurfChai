package com.turfchai.reward.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Response payload for {@code GET /api/v1/rewards/my-points}. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointsSummaryResponse {
    private Integer balance;
    private BigDecimal walletBalance;
    private TierResponse currentTier;
    private TierResponse nextTier;
    private Integer pointsToNextTier;
    /** 0-100, how far through the current-to-next tier range the balance sits. Null when at the top tier. */
    private Integer progressPercent;
}
