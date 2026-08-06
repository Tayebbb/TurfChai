package com.turfchai.reward.dto.response;

import com.turfchai.reward.entity.RedemptionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Response payload for {@code POST /api/v1/rewards/redeem}. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RedemptionResponse {
    private Long redemptionId;
    private String rewardName;
    private Integer pointsSpent;
    private Integer newBalance;
    private RedemptionStatus status;
    /** Populated when the redeemed reward is a WALLET_CREDIT that was applied immediately. */
    private BigDecimal walletCreditAmount;
    private BigDecimal newWalletBalance;
}
