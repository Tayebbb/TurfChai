package com.turfchai.tournament.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** A team registered into a tournament. */
@Entity
@Table(name = "tournament_teams", uniqueConstraints = @UniqueConstraint(
        name = "uq_tournament_team_name", columnNames = {"tournament_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
public class TournamentTeam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournament tournament;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String captainName;

    /**
     * 'pending' | 'paid' — entry-fee tracking only. Actual payment
     * processing is owned by the payments module; this flag is what the
     * bracket generator checks before seeding a team.
     */
    @Column(nullable = false, length = 10)
    private String entryFeeStatus = "pending";

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal entryFeePaid = BigDecimal.ZERO;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();
}
