package com.turfchai.venue.repository;

import com.turfchai.venue.entity.Pitch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PitchRepository extends JpaRepository<Pitch, Long> {

    List<Pitch> findByVenueIdAndActiveTrue(Long venueId);

    List<Pitch> findByVenueSlug(String slug);

    // Open-games module lookup (moved from the deleted stub repository)
    List<Pitch> findByVenueId(Long venueId);

    /**
     * Locks the pitch row for the duration of the transaction — used to
     * serialize concurrent slot reservations on the same pitch.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Pitch p where p.id = :id")
    Optional<Pitch> findByIdForUpdate(@Param("id") Long id);
}
