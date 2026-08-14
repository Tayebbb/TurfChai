package com.turfchai.tournament.entity;

import com.turfchai.venue.entity.Pitch;
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

import java.time.LocalTime;

/** One match in the tournament bracket, scheduled on a reserved pitch/time. */
@Entity
@Table(name = "tournament_fixtures", uniqueConstraints = @UniqueConstraint(
        name = "uq_fixture_pitch_time", columnNames = {"tournament_id", "pitch_id", "start_time"}))
@Getter
@Setter
@NoArgsConstructor
public class TournamentFixture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournament tournament;

    /** e.g. 'R16', 'QF', 'SF', 'Final'. */
    @Column(nullable = false, length = 20)
    private String roundLabel;

    /** Order within the round, 1-based. */
    @Column(name = "match_number", nullable = false)
    private int matchNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pitch_id")
    private Pitch pitch;

    @Column(name = "start_time")
    private LocalTime startTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_a_id")
    private TournamentTeam teamA;

    /** Null means a bye for teamA. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_b_id")
    private TournamentTeam teamB;

    /** 'SCHEDULED' | 'BYE' (baseline uses uppercase statuses). */
    @Column(nullable = false, length = 12)
    private String status = "SCHEDULED";
}
