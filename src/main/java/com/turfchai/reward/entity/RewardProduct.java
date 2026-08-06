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

/**
 * A redeemable catalog item. Maps to the V1 baseline {@code reward_products}
 * table, pre-seeded with the five rewards described in
 * {@code ai-knowledge/loyalty-rewards.md}.
 */
@Entity
@Table(name = "reward_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 30)
    private RewardKind kind;

    @Column(name = "cost_points", nullable = false)
    private Integer costPoints;

    /**
     * Currency value for WALLET_CREDIT/DISCOUNT_NEXT; null for FREE_SLOT/PRIORITY_PASS.
     * Backtick-quoted because {@code value} is a reserved word in H2 (used by the
     * dev/test profiles) — unquoted, {@code create table} fails with a syntax error.
     */
    @Column(name = "`value`")
    private BigDecimal value;

    @Column(name = "description")
    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
