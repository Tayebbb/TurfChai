package com.turfchai.venue.repository;

import com.turfchai.venue.entity.SportPricingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SportPricingRuleRepository extends JpaRepository<SportPricingRule, Long> {

    Optional<SportPricingRule> findByVenueIdAndSportIdAndWindowType(Long venueId, Long sportId, String windowType);
}
