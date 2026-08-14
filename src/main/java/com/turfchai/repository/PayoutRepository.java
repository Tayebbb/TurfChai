package com.turfchai.repository;

import com.turfchai.model.Payout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PayoutRepository extends JpaRepository<Payout, Long> {

    List<Payout> findByStatusOrderByCreatedAtDesc(String status);

    List<Payout> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId);

    Optional<Payout> findByPayoutCode(String payoutCode);

    List<Payout> findAllByOrderByCreatedAtDesc();
}
