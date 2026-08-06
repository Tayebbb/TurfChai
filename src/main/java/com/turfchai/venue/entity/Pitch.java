package com.turfchai.venue.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/** An individual playable pitch/court inside a venue. */
@Entity
@Table(name = "pitches",
       uniqueConstraints = @UniqueConstraint(name = "uq_pitches_venue_name", columnNames = {"venue_id", "name"}),
       indexes = @Index(name = "idx_pitches_venue", columnList = "venue_id"))
@Getter
@Setter
@NoArgsConstructor
public class Pitch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false, length = 80)
    private String name;

    /** e.g. '5_a_side', '7_a_side', '11_a_side' */
    @Column(length = 20)
    private String format;

    @Column(name = "surface_type", length = 100)
    private String surfaceType;

    @Column(name = "surface_detail", length = 255)
    private String surfaceDetail;

    /** e.g. '30×50 m' */
    @Column(length = 40)
    private String dimensions;

    @Column(length = 120)
    private String lighting;

    @Column(name = "max_players", nullable = false)
    private int maxPlayers = 10;

    @Column(nullable = false)
    private boolean indoor = false;

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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "pitch_sports",
               joinColumns = @JoinColumn(name = "pitch_id"),
               inverseJoinColumns = @JoinColumn(name = "sport_id"))
    private Set<Sport> sports = new LinkedHashSet<>();
}
