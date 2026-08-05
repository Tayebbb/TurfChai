package com.turfchai.player.repository;

import com.turfchai.player.entity.SavedVenue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedVenueRepository extends JpaRepository<SavedVenue, SavedVenue.Key> {

    List<SavedVenue> findByIdUserIdOrderByCreatedAtDesc(Long userId);

    Optional<SavedVenue> findByIdUserIdAndIdVenueId(Long userId, Long venueId);

    boolean existsByIdUserIdAndIdVenueId(Long userId, Long venueId);
}
