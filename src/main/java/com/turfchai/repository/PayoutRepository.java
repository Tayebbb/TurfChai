package com.turfchai.repository;

import com.turfchai.model.Payout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PayoutRepository extends JpaRepository<Payout, Long> {

    List<Payout> findByStatusOrderByCreatedAtDesc(String status);

    List<Payout> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId);

    Optional<Payout> findByPayoutCode(String payoutCode);

    List<Payout> findAllByOrderByCreatedAtDesc();

    @Query("select sum(p.netAmount) from Payout p where p.status = :status")
    BigDecimal sumNetAmountByStatus(@Param("status") String status);

    long countByStatus(String status);
}
