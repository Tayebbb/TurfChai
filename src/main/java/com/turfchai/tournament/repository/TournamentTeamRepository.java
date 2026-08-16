package com.turfchai.tournament.repository;

import com.turfchai.tournament.entity.TournamentTeam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentTeamRepository extends JpaRepository<TournamentTeam, Long> {

    List<TournamentTeam> findByTournamentIdOrderByJoinedAtAsc(Long tournamentId);

    boolean existsByTournamentIdAndNameIgnoreCase(Long tournamentId, String name);

    boolean existsByTournamentIdAndRegisteredById(Long tournamentId, Long registeredById);

    long countByTournamentId(Long tournamentId);
}
