package com.turfchai.tournament.repository;

import com.turfchai.tournament.entity.Tournament;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TournamentRepository extends JpaRepository<Tournament, Long> {

        Optional<Tournament> findByCode(String code);

        boolean existsByCode(String code);

        /** Browse feed: published/confirmed tournaments, soonest first. */
        @Query("""
                        select t from Tournament t
                        where t.status in ('PUBLISHED', 'CONFIRMED')
                          and (:openOnly = false or t.privacy = 'OPEN')
                          and (CAST(:fromDate AS date) is null or t.tournamentDate >= CAST(:fromDate AS date))
                        order by t.tournamentDate asc
                        """)
        Page<Tournament> browse(@Param("openOnly") boolean openOnly,
                        @Param("fromDate") LocalDate fromDate,
                        Pageable pageable);

        /** Tournaments a player has registered a team for. */
        @Query("""
                        select distinct t from Tournament t
                        join TournamentTeam team on team.tournament = t
                        where team.registeredBy.id = :userId
                        order by t.tournamentDate desc
                        """)
        List<Tournament> findRegisteredBy(@Param("userId") Long userId);

        /** Tournaments the caller hosts, soonest first. */
        List<Tournament> findByHostIdOrderByTournamentDateDesc(Long hostId);
}
