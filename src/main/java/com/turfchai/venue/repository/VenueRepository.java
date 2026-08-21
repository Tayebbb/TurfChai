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
    @org.springframework.data.jpa.repository.Query("SELECT v FROM Venue v WHERE v.owner.id = :ownerUserId ORDER BY v.id ASC")
    List<Venue> findByOwnerId(Long ownerUserId);

    // Weather sync
    @org.springframework.data.jpa.repository.Query(value = "SELECT DISTINCT grid_lat, grid_lon FROM venues WHERE status = 'LIVE' AND grid_lat IS NOT NULL AND grid_lon IS NOT NULL", nativeQuery = true)
    List<Object[]> findDistinctGridCoordinates();
}
