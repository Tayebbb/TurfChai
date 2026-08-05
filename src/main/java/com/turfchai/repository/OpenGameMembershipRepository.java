package com.turfchai.repository;

import com.turfchai.model.OpenGameMembership;
import com.turfchai.model.enums.GameMembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OpenGameMembershipRepository extends JpaRepository<OpenGameMembership, Long> {

    boolean existsByOpenGameIdAndUserId(Long openGameId, Long userId);

    Optional<OpenGameMembership> findByOpenGameIdAndUserId(Long openGameId, Long userId);

    List<OpenGameMembership> findByOpenGameId(Long openGameId);

    List<OpenGameMembership> findByUserId(Long userId);

    long countByOpenGameIdAndStatusIn(Long openGameId, List<GameMembershipStatus> statuses);
}
