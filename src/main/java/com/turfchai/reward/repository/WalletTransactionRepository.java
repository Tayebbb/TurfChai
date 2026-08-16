package com.turfchai.reward.repository;

import com.turfchai.reward.entity.WalletTransaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    @Query("select coalesce(sum(t.delta), 0) from WalletTransaction t where t.userId = :userId")
    BigDecimal sumDeltaByUserId(@Param("userId") Long userId);

    /** Wallet credit spent on one booking, as a negative total. */
    @Query("select coalesce(sum(t.delta), 0) from WalletTransaction t "
            + "where t.bookingId = :bookingId and t.reason = com.turfchai.reward.entity.WalletReason.CHECKOUT_APPLY")
    BigDecimal sumSpentOnBooking(@Param("bookingId") Long bookingId);

    List<WalletTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
