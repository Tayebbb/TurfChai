package com.turfchai.reward.repository;

import com.turfchai.reward.entity.PointLedgerEntry;
import com.turfchai.reward.entity.PointReason;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PointLedgerRepository extends JpaRepository<PointLedgerEntry, Long> {

    List<PointLedgerEntry> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * Current point balance, computed as the sum of every ledger delta.
     * Recomputing from the full ledger (rather than trusting the last
     * {@code balance_after} snapshot) keeps the balance correct even if
     * entries are ever inserted out of order.
     */
    @Query("select coalesce(sum(e.delta), 0) from PointLedgerEntry e where e.userId = :userId")
    int sumDeltaByUserId(@Param("userId") Long userId);

    /** Net points this booking is currently worth — awards minus any reversal. */
    @Query("select coalesce(sum(e.delta), 0) from PointLedgerEntry e "
            + "where e.userId = :userId and e.referenceBookingId = :bookingId")
    int sumDeltaForBooking(@Param("userId") Long userId, @Param("bookingId") Long bookingId);

    boolean existsByUserIdAndReason(Long userId, PointReason reason);
}
