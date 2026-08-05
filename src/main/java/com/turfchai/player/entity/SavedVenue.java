package com.turfchai.player.entity;

import com.turfchai.venue.entity.Venue;
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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A venue bookmarked by a player. */
@Entity
@Table(name = "saved_venues",
        uniqueConstraints = @UniqueConstraint(name = "uq_saved_user_venue", columnNames = {"user_id", "venue_id"}),
        indexes = @Index(name = "idx_saved_venues_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class SavedVenue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public SavedVenue(User user, Venue venue) {
        this.user = user;
        this.venue = venue;
    }
}
