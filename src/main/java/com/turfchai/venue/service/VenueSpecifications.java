package com.turfchai.venue.service;

import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Composable JPA Specifications implementing the discovery filters. */
public final class VenueSpecifications {

    private VenueSpecifications() {
    }

    public static Specification<Venue> matching(VenueSearchCriteria criteria) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (notBlank(criteria.query())) {
                String like = "%" + criteria.query().toLowerCase(Locale.ROOT) + "%";
                Subquery<Long> sportMatch = query.subquery(Long.class);
                var pitch = sportMatch.from(Pitch.class);
                Join<Pitch, Sport> sport = pitch.join("sports", JoinType.INNER);
                sportMatch.select(pitch.get("id")).where(
                        cb.equal(pitch.get("venue"), root),
                        cb.isTrue(pitch.get("active")),
                        cb.or(
                                cb.like(cb.lower(sport.get("slug")), like),
                                cb.like(cb.lower(sport.get("name")), like)));

                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("area")), like),
                        cb.like(cb.lower(root.get("address")), like),
                        cb.exists(sportMatch)));
            }
            if (notBlank(criteria.area())) {
                predicates.add(cb.equal(cb.lower(root.get("area")), criteria.area().toLowerCase(Locale.ROOT)));
            }
            if (criteria.verified() != null) {
                predicates.add(cb.equal(root.get("verified"), criteria.verified()));
            }
            if (criteria.openAt() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("openTime"), criteria.openAt()));
                predicates.add(cb.greaterThan(root.get("closeTime"), criteria.openAt()));
            }
            if (criteria.amenities() != null) {
                for (String amenity : criteria.amenities()) {
                    if (notBlank(amenity)) {
                        predicates.add(cb.like(cb.lower(root.get("amenities")),
                                "%" + amenity.toLowerCase(Locale.ROOT) + "%"));
                    }
                }
            }
            if (notBlank(criteria.sport())) {
                // venue has at least one active pitch supporting the sport
                Subquery<Long> sub = query.subquery(Long.class);
                var pitch = sub.from(Pitch.class);
                Join<Pitch, Sport> sport = pitch.join("sports", JoinType.INNER);
                sub.select(pitch.get("id")).where(
                        cb.equal(pitch.get("venue"), root),
                        cb.isTrue(pitch.get("active")),
                        cb.equal(cb.lower(sport.get("slug")), criteria.sport().toLowerCase(Locale.ROOT)));
                predicates.add(cb.exists(sub));
            }
            if (criteria.minPrice() != null || criteria.maxPrice() != null) {
                // venue has an active pricing rule inside the requested range
                Subquery<Long> sub = query.subquery(Long.class);
                var rule = sub.from(SportPricingRule.class);
                List<Predicate> rulePredicates = new ArrayList<>();
                rulePredicates.add(cb.equal(rule.get("venue"), root));
                rulePredicates.add(cb.isTrue(rule.get("active")));
                if (criteria.minPrice() != null) {
                    rulePredicates.add(cb.greaterThanOrEqualTo(rule.get("rate"), criteria.minPrice()));
                }
                if (criteria.maxPrice() != null) {
                    rulePredicates.add(cb.lessThanOrEqualTo(rule.get("rate"), criteria.maxPrice()));
                }
                sub.select(rule.get("id")).where(rulePredicates.toArray(Predicate[]::new));
                predicates.add(cb.exists(sub));
            }
            if (criteria.nearLat() != null && criteria.nearLng() != null && criteria.radiusKm() != null) {
                // cheap bounding box; exact distance is computed/sorted in the service
                BigDecimal latDelta = BigDecimal.valueOf(criteria.radiusKm() / 111.0);
                BigDecimal lngDelta = BigDecimal.valueOf(criteria.radiusKm() / 102.0); // ~cos(23.8°) Dhaka
                predicates.add(cb.between(root.get("lat"),
                        criteria.nearLat().subtract(latDelta), criteria.nearLat().add(latDelta)));
                predicates.add(cb.between(root.get("lng"),
                        criteria.nearLng().subtract(lngDelta), criteria.nearLng().add(lngDelta)));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
