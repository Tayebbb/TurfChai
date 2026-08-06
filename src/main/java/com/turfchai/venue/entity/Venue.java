package com.turfchai.venue.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A bookable sports facility managed by an owner.
 * Player-facing read operations live in VenueSearchService;
 * owner-side management is handled by VenueManagementService.
 */
@Entity
@Table(name = "venues", indexes = {
        @Index(name = "idx_venues_area", columnList = "area"),
        @Index(name = "idx_venues_location", columnList = "lat, lng"),
        @Index(name = "idx_venues_rating", columnList = "rating_avg"),
        @Index(name = "idx_venues_owner", columnList = "owner_user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** URL-friendly identifier used by the frontend routes, e.g. "kick-off-arena". */
    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    /** Short operator-facing code, e.g. VEN-1024. */
    @Column(name = "venue_code", unique = true, length = 12)
    private String venueCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    @JsonIgnore
    private com.turfchai.model.User owner;

    /** Lifecycle status: DRAFT | PENDING_LISTING | LIVE | SUSPENDED | REJECTED */
    @Column(length = 30)
    @Builder.Default
    private String status = "DRAFT";

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 255)
    @Builder.Default
    private String address = "";

    @Column(nullable = false, length = 100)
    @Builder.Default
    private String area = "";

    @Column(precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(precision = 10, scale = 7)
    private BigDecimal lng;

    // ── Reputation (maintained by triggers / review service) ──────────────

    @Column(name = "rating_avg", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    @Builder.Default
    private int reviewCount = 0;

    @Column(name = "saved_count", nullable = false)
    @Builder.Default
    private int savedCount = 0;

    // ── Badges & discovery ────────────────────────────────────────────────

    @Column(name = "is_verified", nullable = false)
    @Builder.Default
    private boolean verified = false;

    @Column(name = "is_tournament_ready", nullable = false)
    @Builder.Default
    private boolean tournamentReady = false;

    @Column(name = "has_promotion", nullable = false)
    @Builder.Default
    private boolean hasPromotion = false;

    /** Marketing badge shown on cards, e.g. "Buy 5 get 1 free". */
    @Column(name = "promotion_label", length = 100)
    private String promotionLabel;

    /**
     * Comma-separated photo URLs (Cloudinary).
     * The DB column stores the full JSONB array in production; this field is the
     * interim CSV representation used by the JPA entity layer.
     */
    @Column(name = "photos_csv", length = 2000)
    private String photos;

    /**
     * Comma-separated amenity keys, e.g. "floodlights,parking,changing_room".
     */
    @Column(name = "amenities_csv", length = 500)
    private String amenities;

    // ── Operations ────────────────────────────────────────────────────────

    @Column(name = "rules")
    private String rules;

    @Column(name = "open_time", nullable = false)
    @Builder.Default
    private LocalTime openTime = LocalTime.of(6, 0);

    @Column(name = "close_time", nullable = false)
    @Builder.Default
    private LocalTime closeTime = LocalTime.of(23, 0);

    @Column(name = "default_buffer_min", nullable = false)
    @Builder.Default
    private int defaultBufferMin = 10;

    /** 'FULL_ONLY' | 'THIRTY_PERCENT' | 'FIFTY_PERCENT' */
    @Column(name = "deposit_policy", length = 30)
    @Builder.Default
    private String depositPolicy = "FULL_ONLY";

    /** 'FREE_24H_50_6H' | 'FLEXIBLE_6H' | 'STRICT_NO_REFUND' */
    @Column(name = "cancel_policy", length = 30)
    @Builder.Default
    private String cancelPolicy = "FREE_24H_50_6H";

    @Column(name = "allow_split_payment", nullable = false)
    @Builder.Default
    private boolean allowSplitPayment = true;

    @Column(name = "minimum_refund_hours", nullable = false)
    @Builder.Default
    private int minimumRefundHours = 6;

    @Column(name = "refund_window_full_hours", nullable = false)
    @Builder.Default
    private int refundWindowFullHours = 24;

    // ── Contact & payouts ─────────────────────────────────────────────────

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    // ── Timestamps ────────────────────────────────────────────────────────

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
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

    // ── Relations ─────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "venue", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<Pitch> pitches = new ArrayList<>();

    @OneToMany(mappedBy = "venue", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<SportPricingRule> pricingRules = new ArrayList<>();

    // ── Helper mutators ───────────────────────────────────────────────────

    public void addPitch(Pitch pitch) {
        pitch.setVenue(this);
        pitches.add(pitch);
    }

    public void addPricingRule(SportPricingRule rule) {
        rule.setVenue(this);
        pricingRules.add(rule);
    }
}
