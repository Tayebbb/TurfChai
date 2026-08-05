package com.turfchai.venue.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * Per-(venue, sport) slot pricing window. Read-side: discovery uses the
 * cheapest active rate as the "from" price; rule management is owner-side.
 */
@Entity
@Table(name = "sport_pricing_rules", indexes = @Index(name = "idx_pricing_venue_sport", columnList = "venue_id, sport_id"))
@Getter
@Setter
@NoArgsConstructor
public class SportPricingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport_id", nullable = false)
    private Sport sport;

    /** 'off_peak' | 'peak' | 'full_day' */
    @Column(nullable = false, length = 12)
    private String windowType;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal rate;

    @Column(nullable = false)
    private int slotDurationMin = 60;

    @Column(nullable = false)
    private LocalTime windowStart = LocalTime.of(6, 0);

    @Column(nullable = false)
    private LocalTime windowEnd = LocalTime.of(23, 0);

    @Column(name = "is_active", nullable = false)
    private boolean active = true;
}
