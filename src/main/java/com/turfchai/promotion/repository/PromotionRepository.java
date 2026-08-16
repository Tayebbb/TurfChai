package com.turfchai.promotion.repository;

import com.turfchai.promotion.entity.Promotion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    List<Promotion> findByVenueId(Long venueId);

    List<Promotion> findByVenueIdAndActiveTrue(Long venueId);

    Optional<Promotion> findByCodeAndActiveTrue(String code);

    Optional<Promotion> findByVenueIdAndCode(Long venueId, String code);

    boolean existsByVenueIdAndCode(Long venueId, String code);

    /**
     * Locks the promotion row so a usage limit cannot be overshot by two
     * checkouts redeeming the last remaining use at once. Matches on code alone:
     * a redemption must still be releasable after the limit deactivated it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where upper(p.code) = upper(:code)")
    Optional<Promotion> findByCodeForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where p.venue.id = :venueId and upper(p.code) = upper(:code)")
    Optional<Promotion> findByVenueAndCodeForUpdate(@Param("venueId") Long venueId, @Param("code") String code);

    /**
     * Promotions a player could actually redeem right now: active, inside
     * their validity window, and — where a usage limit exists — not yet
     * exhausted. Backs the checkout page's "browse codes" list, so it must
     * not surface a code {@code validate-code} would immediately refuse.
     */
    @Query("select p from Promotion p where p.venue.id = :venueId and p.active = true "
            + "and p.validFrom <= :now and (p.validUntil is null or p.validUntil >= :now) "
            + "and (p.usageLimit is null or p.usageCount < p.usageLimit) "
            + "order by p.createdAt desc")
    List<Promotion> findAvailableForVenue(@Param("venueId") Long venueId, @Param("now") Instant now);
}
