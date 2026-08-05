package com.turfchai.repository;

import com.turfchai.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findByVenueCode(String venueCode);
    List<Venue> findByArea(String area);
}
