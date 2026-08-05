package com.turfchai.venue.repository;

import com.turfchai.venue.entity.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long>, JpaSpecificationExecutor<Venue> {

    // collections load lazily inside the read-only service transaction
    Optional<Venue> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
