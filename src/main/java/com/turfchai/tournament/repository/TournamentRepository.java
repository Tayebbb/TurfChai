package com.turfchai.tournament.repository;

import com.turfchai.tournament.entity.Tournament;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TournamentRepository extends JpaRepository<Tournament, Long> {

    Optional<Tournament> findByCode(String code);

    boolean existsByCode(String code);
}
