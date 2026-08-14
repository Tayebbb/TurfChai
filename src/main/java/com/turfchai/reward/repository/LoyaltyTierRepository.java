package com.turfchai.reward.repository;

import com.turfchai.reward.entity.LoyaltyTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoyaltyTierRepository extends JpaRepository<LoyaltyTier, Long> {

    List<LoyaltyTier> findAllByOrderBySortOrderAsc();
}
