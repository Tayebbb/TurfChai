package com.turfchai.promotion.repository;

import com.turfchai.promotion.entity.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    List<Promotion> findByVenueId(Long venueId);

    List<Promotion> findByVenueIdAndActiveTrue(Long venueId);

    Optional<Promotion> findByCodeAndActiveTrue(String code);

    Optional<Promotion> findByVenueIdAndCode(Long venueId, String code);

    boolean existsByVenueIdAndCode(Long venueId, String code);
}
