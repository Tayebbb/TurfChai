package com.turfchai.player.repository;

import com.turfchai.player.entity.SavedVenue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedVenueRepository extends JpaRepository<SavedVenue, Long> {

    List<SavedVenue> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<SavedVenue> findByUserIdAndVenueId(Long userId, Long venueId);

    boolean existsByUserIdAndVenueId(Long userId, Long venueId);
}
