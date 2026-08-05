package com.turfchai.tournament.repository;

import com.turfchai.tournament.entity.TournamentPitchReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface TournamentPitchReservationRepository
        extends JpaRepository<TournamentPitchReservation, Long> {

    List<TournamentPitchReservation> findByTournamentIdOrderBySlotDateAscStartTimeAsc(Long tournamentId);

    /** Any reservation on this pitch/date whose window overlaps [start, end). */
    @Query("""
            select r from TournamentPitchReservation r
            where r.pitch.id = :pitchId
              and r.slotDate = :date
              and r.startTime < :end
              and r.endTime > :start
            """)
    List<TournamentPitchReservation> findOverlapping(@Param("pitchId") Long pitchId,
                                                     @Param("date") LocalDate date,
                                                     @Param("start") LocalTime start,
                                                     @Param("end") LocalTime end);
}
