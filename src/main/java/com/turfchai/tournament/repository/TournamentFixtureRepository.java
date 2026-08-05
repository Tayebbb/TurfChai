package com.turfchai.tournament.repository;

import com.turfchai.tournament.entity.TournamentFixture;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentFixtureRepository extends JpaRepository<TournamentFixture, Long> {

    List<TournamentFixture> findByTournamentIdOrderByStartTimeAscMatchNumberAsc(Long tournamentId);

    void deleteByTournamentId(Long tournamentId);
}
