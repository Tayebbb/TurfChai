package com.turfchai.payment.entity;

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
 * A single payment transaction (a gateway charge or a refund). Maps to the
 * V1 baseline {@code payments} table — see {@code ck_payments_context} for
 * which reference column is required per {@link PaymentType}. Cross-module
 * references (user, booking) are kept as plain foreign-key ids, matching
 * {@code Booking.userId}'s existing style.
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "txn_reference", nullable = false, unique = true, length = 30)
    private String txnReference;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "booking_member_id")
    private Long bookingMemberId;

    @Column(name = "open_game_id")
    private Long openGameId;

    @Column(name = "tournament_id")
    private Long tournamentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private PaymentType type;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private String currency = "BDT";

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 20)
    private PaymentMethod method;

    @Column(name = "provider", length = 30)
    private String provider;

    @Column(name = "provider_txn_id", length = 80)
    private String providerTxnId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.INITIATED;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "hold_until")
    private OffsetDateTime holdUntil;

    @Column(name = "is_reward_wallet_payment", nullable = false)
    @Builder.Default
    private Boolean isRewardWalletPayment = false;

    @Column(name = "matched_to_booking_id")
    private Long matchedToBookingId;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "refund_of_payment_id")
    private Long refundOfPaymentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
