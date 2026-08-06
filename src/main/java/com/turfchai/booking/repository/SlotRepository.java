package com.turfchai.booking.repository;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SlotRepository extends JpaRepository<Slot, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Slot s WHERE s.id = :id")
    Optional<Slot> findByIdForUpdate(@Param("id") Long id);

    /** HELD slots whose hold window has passed; candidates for cleanup. */
    List<Slot> findByStatusAndHoldExpiresAtBefore(SlotStatus status, OffsetDateTime before);
}
