package com.turfchai.player.entity;

import com.turfchai.model.User;
import com.turfchai.venue.entity.Venue;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

/** A venue bookmarked by a player. PK is (user_id, venue_id) per the Flyway baseline. */
@Entity
@Table(name = "saved_venues")
@Getter
@Setter
@NoArgsConstructor
public class SavedVenue {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "user_id")
        private Long userId;

        @Column(name = "venue_id")
        private Long venueId;

        public Key(Long userId, Long venueId) {
            this.userId = userId;
            this.venueId = venueId;
        }
    }

    @EmbeddedId
    private Key id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("venueId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public SavedVenue(User user, Venue venue) {
        this.id = new Key(user.getId(), venue.getId());
        this.user = user;
        this.venue = venue;
    }
}
