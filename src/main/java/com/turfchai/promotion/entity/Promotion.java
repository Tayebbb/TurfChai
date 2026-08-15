package com.turfchai.promotion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A promotional discount code attached to a venue.
 *
 * <p>discount_type:
 * <ul>
 *   <li>PERCENT — discount_value is a percentage (0..100), optionally capped by max_discount_amount</li>
 *   <li>FLAT    — discount_value is a flat BDT amount off the order total</li>
 * </ul>
 *
 * <p>conditions (stored as JSON string, validated in service layer):
 * <pre>
 * {
 *   "sports": ["football"],   // optional: only for these sport slugs
 *   "days_of_week": [6, 7],   // optional: ISO 1-7
 *   "min_players": 8          // optional
 * }
 * </pre>
 */
@Entity
@Table(name = "promotions", indexes = {
        @Index(name = "idx_promotions_venue", columnList = "venue_id"),
        @Index(name = "idx_promotions_code", columnList = "code")
})
@Getter
@Setter
@NoArgsConstructor
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private com.turfchai.venue.entity.Venue venue;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
    private String label;

    /** 'PERCENT' | 'FLAT' */
    @Column(name = "discount_type", nullable = false, length = 10)
    private String discountType = "PERCENT";

    @Column(name = "discount_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountValue;

    /** Minimum order total (BDT) before the promo applies. Default 0 = no minimum. */
    @Column(name = "min_order_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal minOrderAmount = BigDecimal.ZERO;

    /** Maximum discount cap in BDT. Null = uncapped. */
    @Column(name = "max_discount_amount", precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount;

    /** JSONB conditions stored as JSON string. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "conditions", columnDefinition = "jsonb")
    private String conditions = "{}";

    @Column(name = "valid_from", nullable = false)
    private Instant validFrom = Instant.now();

    @Column(name = "valid_until")
    private Instant validUntil;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "usage_count", nullable = false)
    private int usageCount = 0;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
