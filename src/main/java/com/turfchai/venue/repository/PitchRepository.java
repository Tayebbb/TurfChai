package com.turfchai.venue.repository;

import com.turfchai.venue.entity.Pitch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PitchRepository extends JpaRepository<Pitch, Long> {

    List<Pitch> findByVenueIdAndActiveTrue(Long venueId);
}
