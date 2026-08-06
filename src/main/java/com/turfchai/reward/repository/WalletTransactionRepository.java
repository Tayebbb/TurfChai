package com.turfchai.reward.repository;

import com.turfchai.reward.entity.WalletTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    @Query("select coalesce(sum(t.delta), 0) from WalletTransaction t where t.userId = :userId")
    BigDecimal sumDeltaByUserId(@Param("userId") Long userId);
}
