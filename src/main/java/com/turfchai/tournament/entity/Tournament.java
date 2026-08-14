package com.turfchai.tournament.entity;

import com.turfchai.model.User;
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
    @Column(name = "tournament_code", nullable = false, unique = true, length = 16)
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

    @Column(name = "time_window_start", nullable = false)
    private LocalTime windowStart;

    @Column(name = "time_window_end", nullable = false)
    private LocalTime windowEnd;

    /** '5_A_SIDE' | '6_A_SIDE' | '7_A_SIDE' | 'KNOCKOUT' (baseline CHECK values). */
    @Column(nullable = false, length = 20)
    private String format;

    @Column(nullable = false)
    private int teamCapacity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal entryFeePerTeam = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal prizePool = BigDecimal.ZERO;

    /** 'OPEN' | 'INVITE_ONLY' (baseline CHECK values). */
    @Column(nullable = false, length = 15)
    private String privacy = "OPEN";

    @Column(nullable = false, unique = true, length = 40)
    private String inviteCode;

    /** 'DRAFT' | 'PUBLISHED' | 'CONFIRMED' (baseline CHECK values). */
    @Column(nullable = false, length = 15)
    private String status = "DRAFT";

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAmount = BigDecimal.ZERO;

    /** 'UNPAID' | 'PAID'. */
    @Column(name = "deposit_status", nullable = false, length = 15)
    private String depositStatus = "UNPAID";

    @Column(name = "deposit_paid_at")
    private Instant depositPaidAt;

    @Column(name = "deposit_method", length = 30)
    private String depositMethod;

    /** Payment-gateway reference; the balance receipt is reconciled against it. */
    @Column(name = "deposit_reference", length = 60)
    private String depositReference;

    /** Weeks the reserved slot pattern repeats, counting the tournament date itself. */
    @Column(name = "repeat_weeks", nullable = false)
    private int repeatWeeks = 1;

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
