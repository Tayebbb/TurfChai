package com.turfchai.venue.entity;

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
 * A bookable sports facility. Read-side model for player discovery;
 * owner-side management (status transitions, payout details) is a separate
 * feature owned by another developer.
 */
@Entity
@Table(name = "venues", indexes = {
        @Index(name = "idx_venues_area", columnList = "area"),
        @Index(name = "idx_venues_location", columnList = "lat, lng"),
        @Index(name = "idx_venues_rating", columnList = "rating_avg")
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

    /**
     * URL-friendly identifier used by the frontend routes, e.g. `kick-off-arena`.
     */
    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    /** Short operator-facing code (owner module), e.g. VEN-1024. */
    @Column(name = "venue_code", unique = true, length = 12)
    private String venueCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private com.turfchai.model.User owner;

    /** Lifecycle status per the baseline schema, e.g. LIVE. */
    @Column(length = 30)
    @Builder.Default
    private String status = "LIVE";

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(nullable = false, length = 100)
    private String area;

    @Column(precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "rating_avg", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    @Builder.Default
    private int reviewCount = 0;

    @Column(name = "is_verified", nullable = false)
    @Builder.Default
    private boolean verified = false;

    /** Marketing badge shown on cards, e.g. "Buy 5 get 1 free". */
    @Column(name = "promotion_label", length = 100)
    private String promotionLabel;

    /**
     * Comma-separated amenity keys, e.g. "floodlights,parking,changing_room".
     * Interim representation beside the baseline's JSONB `amenities` column.
     */
    @Column(name = "amenities_csv", length = 500)
    private String amenities;

    @Column(name = "open_time", nullable = false)
    @Builder.Default
    private LocalTime openTime = LocalTime.of(6, 0);

    @Column(name = "close_time", nullable = false)
    @Builder.Default
    private LocalTime closeTime = LocalTime.of(23, 0);

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "venue", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Pitch> pitches = new ArrayList<>();

    @OneToMany(mappedBy = "venue", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SportPricingRule> pricingRules = new ArrayList<>();

    public void addPitch(Pitch pitch) {
        pitch.setVenue(this);
        pitches.add(pitch);
    }

    public void addPricingRule(SportPricingRule rule) {
        rule.setVenue(this);
        pricingRules.add(rule);
    }
}
