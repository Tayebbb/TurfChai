package com.turfchai.venue.repository;

import com.turfchai.venue.entity.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long>, JpaSpecificationExecutor<Venue> {

    // Player-facing lookups
    Optional<Venue> findBySlug(String slug);
    boolean existsBySlug(String slug);
    Optional<Venue> findByVenueCode(String venueCode);
    List<Venue> findByArea(String area);

    // Owner-facing lookups
    List<Venue> findByOwnerId(Long ownerUserId);
}
