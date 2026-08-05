package com.turfchai.venue.repository;

import com.turfchai.venue.entity.Sport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SportRepository extends JpaRepository<Sport, Long> {

    Optional<Sport> findBySlug(String slug);

    // LFG module lookups (moved from the deleted stub repository)
    Optional<Sport> findByNameIgnoreCase(String name);

    Optional<Sport> findBySlugIgnoreCase(String slug);
}
