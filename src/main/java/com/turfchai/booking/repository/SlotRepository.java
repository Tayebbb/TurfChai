package com.turfchai.booking.repository;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SlotRepository extends JpaRepository<Slot, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Slot s WHERE s.id = :id")
    Optional<Slot> findByIdForUpdate(@Param("id") Long id);

    /** HELD slots whose hold window has passed; candidates for cleanup. */
    List<Slot> findByStatusAndHoldExpiresAtBefore(SlotStatus status, OffsetDateTime before);

    /**
     * The caller's own currently-active hold, if any — used both to block a
     * second concurrent hold on a different slot and to let the UI point the
     * player back at whichever slot they already have on hold. Fetches the
     * pitch eagerly so callers outside a transaction (e.g. a REST controller
     * reading the result after the service's read-only transaction closes)
     * can read the pitch name safely.
     */
    @Query("SELECT s FROM Slot s LEFT JOIN FETCH s.pitch WHERE s.heldByUserId = :heldByUserId "
            + "AND s.status = :status AND s.holdExpiresAt > :after ORDER BY s.holdExpiresAt DESC")
    List<Slot> findActiveHoldsByUser(
            @Param("heldByUserId") Long heldByUserId, @Param("status") SlotStatus status, @Param("after") OffsetDateTime after);

    /**
     * A venue's bookable slots on a given day, earliest first — the venue page's
     * availability grid. Fetches the pitch eagerly so callers outside a
     * transaction (e.g. a REST controller) can read pitch name/id safely.
     */
    @Query("SELECT s FROM Slot s JOIN FETCH s.pitch WHERE s.venueId = :venueId AND s.slotDate = :slotDate "
            + "ORDER BY s.startTime ASC")
    List<Slot> findByVenueIdAndSlotDateOrderByStartTimeAsc(@Param("venueId") Long venueId, @Param("slotDate") LocalDate slotDate);

    /** Single-slot lookup with the pitch fetched eagerly, for callers outside a transaction. */
    @Query("SELECT s FROM Slot s JOIN FETCH s.pitch WHERE s.id = :id")
    Optional<Slot> findByIdWithPitch(@Param("id") Long id);

    boolean existsByPitchIdAndSlotDateAndStartTime(Long pitchId, LocalDate slotDate, LocalTime startTime);

    List<Slot> findByVenueIdAndSlotDateBetweenOrderBySlotDateAscStartTimeAsc(Long venueId, LocalDate startDate, LocalDate endDate);

    List<Slot> findByVenueIdIn(List<Long> venueIds);

    List<Slot> findByVenueIdInAndSlotDateBetween(List<Long> venueIds, LocalDate startDate, LocalDate endDate);
}
