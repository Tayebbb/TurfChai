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

import java.time.OffsetDateTime;

/**
 * A single immutable entry in a user's points ledger. Maps to the V1
 * baseline {@code point_ledger} table. Cross-module references (booking,
 * open game, reward) are kept as plain foreign-key ids — the same style
 * {@code Booking.userId} uses — so this module doesn't depend on the
 * booking/open-game entity classes.
 */
@Entity
@Table(name = "point_ledger")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointLedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Positive = earned, negative = spent/expired. */
    @Column(name = "delta", nullable = false)
    private Integer delta;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 30)
    private PointReason reason;

    @Column(name = "reference_booking_id")
    private Long referenceBookingId;

    @Column(name = "reference_open_game_id")
    private Long referenceOpenGameId;

    @Column(name = "reference_reward_id")
    private Long referenceRewardId;

    /** Running balance snapshot immediately after this entry, for auditability. */
    @Column(name = "balance_after", nullable = false)
    private Integer balanceAfter;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
