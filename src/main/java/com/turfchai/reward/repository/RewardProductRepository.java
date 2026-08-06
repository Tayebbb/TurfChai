package com.turfchai.reward.repository;

import com.turfchai.reward.entity.RewardProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RewardProductRepository extends JpaRepository<RewardProduct, Long> {

    List<RewardProduct> findByIsActiveTrueOrderByCostPointsAsc();
}
