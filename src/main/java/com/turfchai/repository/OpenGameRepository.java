package com.turfchai.repository;

import com.turfchai.model.OpenGame;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.SkillLevel;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OpenGameRepository extends JpaRepository<OpenGame, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM OpenGame g WHERE g.id = :id")
    Optional<OpenGame> findWithLockById(@Param("id") Long id);

    Optional<OpenGame> findByGameCode(String gameCode);

    List<OpenGame> findByStatusIn(List<OpenGameStatus> statuses);

    @Query("SELECT DISTINCT g FROM OpenGame g JOIN g.venue v LEFT JOIN g.pitch p LEFT JOIN p.sports s WHERE " +
           "(:skillLevel IS NULL OR g.skillLevel = :skillLevel) AND " +
           "(:gameDate IS NULL OR g.gameDate = :gameDate) AND " +
           "(:query IS NULL OR " +
           " LOWER(g.title) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) OR " +
           " LOWER(v.name) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) OR " +
           " LOWER(v.area) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) OR " +
           " LOWER(v.address) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) OR " +
           " LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')) OR " +
           " LOWER(s.slug) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))) AND " +
           "g.status IN ('OPEN', 'ALMOST_FULL', 'FULL') " +
           "ORDER BY g.gameDate ASC, g.startTime ASC")
    List<OpenGame> searchOpenGames(
        @Param("skillLevel") SkillLevel skillLevel,
        @Param("gameDate") LocalDate gameDate,
        @Param("query") String query
    );
}
