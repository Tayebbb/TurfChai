package com.turfchai.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Records a single reward redemption. Maps to the V1 baseline
 * {@code reward_redemptions} table.
 */
@Entity
@Table(name = "reward_redemptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardRedemption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reward_id", nullable = false)
    private Long rewardId;

    @Column(name = "cost_points", nullable = false)
    private Integer costPoints;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private RedemptionStatus status = RedemptionStatus.ISSUED;

    /** Set when the redeemed reward was a WALLET_CREDIT and has been applied. */
    @Column(name = "wallet_credit_amount")
    private BigDecimal walletCreditAmount;

    /** Set once an ISSUED discount/free-slot/priority-pass reward is applied to a booking. */
    @Column(name = "applied_to_booking_id")
    private Long appliedToBookingId;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
