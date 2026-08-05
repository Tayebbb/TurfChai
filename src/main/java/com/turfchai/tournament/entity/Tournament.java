package com.turfchai.tournament.entity;

import com.turfchai.player.entity.User;
import com.turfchai.venue.entity.Venue;
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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** A host-run tournament at a venue. */
@Entity
@Table(name = "tournaments", indexes = {
        @Index(name = "idx_tournaments_venue_date", columnList = "venue_id, tournament_date"),
        @Index(name = "idx_tournaments_host", columnList = "host_user_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-facing code, e.g. TR-CUP-0091. */
    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_user_id", nullable = false)
    private User host;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false)
    private LocalDate tournamentDate;

    @Column(nullable = false)
    private LocalTime windowStart;

    @Column(nullable = false)
    private LocalTime windowEnd;

    /** '5_a_side' | '6_a_side' | '7_a_side' | 'knockout' */
    @Column(nullable = false, length = 20)
    private String format;

    @Column(nullable = false)
    private int teamCapacity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal entryFeePerTeam = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal prizePool = BigDecimal.ZERO;

    /** 'open' | 'invite_only' */
    @Column(nullable = false, length = 15)
    private String privacy = "open";

    @Column(nullable = false, unique = true, length = 40)
    private String inviteCode;

    /** 'draft' | 'published' | 'confirmed' */
    @Column(nullable = false, length = 15)
    private String status = "draft";

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAmount = BigDecimal.ZERO;

    private LocalDate balanceDueDate;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "tournament", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<TournamentTeam> teams = new ArrayList<>();

    @OneToMany(mappedBy = "tournament", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<TournamentFixture> fixtures = new ArrayList<>();

    @OneToMany(mappedBy = "tournament", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<TournamentPitchReservation> reservations = new ArrayList<>();
}
