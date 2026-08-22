package com.turfchai.booking.entity;

import com.turfchai.payment.entity.PaymentMethod;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "share_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal shareAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    @Builder.Default
    private MemberPaymentStatus paymentStatus = MemberPaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Column(name = "is_captain", nullable = false)
    @Builder.Default
    private Boolean isCaptain = false;

    @Column(name = "invited_at")
    private OffsetDateTime invitedAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "share_token", length = 32)
    private String shareToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
