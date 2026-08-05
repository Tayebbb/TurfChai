package com.turfchai.tournament.entity;

import com.turfchai.venue.entity.Pitch;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A pitch/time slot reserved for a tournament. The unique constraint rejects
 * exact duplicate slots; partial overlaps are prevented by the service layer,
 * which takes a pessimistic lock on the pitch row before its overlap check.
 */
@Entity
@Table(name = "tournament_pitch_reservations",
        uniqueConstraints = @UniqueConstraint(name = "uq_reservation_pitch_slot",
                columnNames = {"pitch_id", "slot_date", "start_time"}),
        indexes = @Index(name = "idx_reservations_pitch_date", columnList = "pitch_id, slot_date"))
@Getter
@Setter
@NoArgsConstructor
public class TournamentPitchReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournament tournament;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pitch_id", nullable = false)
    private Pitch pitch;

    @Column(name = "slot_date", nullable = false)
    private LocalDate slotDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;
}
