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

    @Column(name = "captain_name", length = 100)
    private String captainName;

    /**
     * 'DUE' | 'PAID' — entry-fee tracking only. Actual payment
     * processing is owned by the payments module; this flag is what the
     * bracket generator checks before seeding a team.
     */
    @Column(name = "payment_status", nullable = false, length = 10)
    private String entryFeeStatus = "DUE";

    @Column(name = "entry_fee_paid_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal entryFeePaid = BigDecimal.ZERO;

    /** Player-facing registration reference, e.g. REG-8F3K21. */
    @Column(name = "registration_code", length = 20, unique = true)
    private String registrationCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registered_by_user_id")
    private com.turfchai.model.User registeredBy;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "emergency_contact", length = 120)
    private String emergencyContact;

    @Column(name = "jersey_number", length = 8)
    private String jerseyNumber;

    @Column(name = "skill_level", length = 20)
    private String skillLevel;

    @Column(name = "medical_notes", length = 500)
    private String medicalNotes;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();
}
