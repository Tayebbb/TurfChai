package com.turfchai.venue.repository;

import com.turfchai.venue.entity.SportPricingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SportPricingRuleRepository extends JpaRepository<SportPricingRule, Long> {

    Optional<SportPricingRule> findByVenueIdAndSportIdAndWindowType(Long venueId, Long sportId, String windowType);

    /**
     * Active rules with the sport joined, so callers outside a transaction can read
     * the slug.
     */
    @Query("select r from SportPricingRule r join fetch r.sport where r.venue.id = :venueId and r.active = true")
    List<SportPricingRule> findActiveByVenueId(@Param("venueId") Long venueId);
}
