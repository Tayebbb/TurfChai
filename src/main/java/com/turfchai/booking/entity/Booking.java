package com.turfchai.booking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * A booking against a single slot. Maps to the V1 {@code bookings} table:
 * the user column exists there as {@code booker_user_id}, and
 * {@code booking_code} / {@code status} / {@code created_at} /
 * {@code updated_at} were already present.
 */
@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_code", nullable = false, unique = true, length = 14)
    private String bookingCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "slot_id", nullable = false)
    private Slot slot;

    @Column(name = "booker_user_id", nullable = false)
    private Long userId;

    @Column(name = "venue_id", nullable = false)
    private Long venueId;

    @Column(name = "pitch_id", nullable = false)
    private Long pitchId;

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "gross_amount", nullable = false)
    private BigDecimal grossAmount;

    @Column(name = "net_amount", nullable = false)
    private BigDecimal netAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "checked_in_at")
    private OffsetDateTime checkedInAt;

    /**
     * The venue's cancellation policy as it stood when this booking was confirmed.
     *
     * <p>
     * Refunds are quoted and paid from this, not from the venue's current
     * setting — otherwise an owner could tighten their terms after a player had
     * already paid and keep money the player was owed.
     */
    @Column(name = "cancel_policy_snapshot", length = 30)
    private String cancelPolicySnapshot;

    /**
     * Promo code redeemed for this booking, so a cancellation can hand the use
     * back.
     */
    @Column(name = "promo_code", length = 30)
    private String promoCode;

    @Column(name = "discount_amount")
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "source", length = 20)
    @Builder.Default
    private String source = "ONLINE";

    @Column(name = "guest_name", length = 100)
    private String guestName;

    @Column(name = "guest_phone", length = 30)
    private String guestPhone;

    @Column(name = "split_enabled", nullable = false)
    @Builder.Default
    private Boolean splitEnabled = false;

    @Column(name = "split_deadline")
    private OffsetDateTime splitDeadline;

    @Column(name = "split_total_paid")
    @Builder.Default
    private BigDecimal splitTotalPaid = BigDecimal.ZERO;

    @Column(name = "split_remaining")
    @Builder.Default
    private BigDecimal splitRemaining = BigDecimal.ZERO;

    @Column(name = "open_game_id")
    private Long openGameId;

    @Column(name = "notes")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    /**
     * Guards the status transitions. Confirm and cancel both read, decide, then
     * write; without a version column two concurrent requests could each decide
     * against the same stale status and the second write would silently win.
     */
    @Version
    @Column(name = "version")
    @Builder.Default
    private Long version = 0L;

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
