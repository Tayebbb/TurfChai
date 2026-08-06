package com.turfchai.reward.repository;

import com.turfchai.reward.entity.RewardRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RewardRedemptionRepository extends JpaRepository<RewardRedemption, Long> {

    List<RewardRedemption> findByUserIdOrderByCreatedAtDesc(Long userId);
}
