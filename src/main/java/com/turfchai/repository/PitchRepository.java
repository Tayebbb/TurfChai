package com.turfchai.repository;

import com.turfchai.model.Pitch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PitchRepository extends JpaRepository<Pitch, Long> {
    List<Pitch> findByVenueId(Long venueId);
}
