package com.turfchai.venue.service;

import com.turfchai.venue.dto.PagedResponse;
import com.turfchai.venue.dto.VenueDetailDto;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Player venue discovery: multi-filter search and detail lookups. */
@Service
@Transactional(readOnly = true)
public class VenueSearchService {

    private static final int MAX_PAGE_SIZE = 50;

    private final VenueRepository venueRepository;

    public VenueSearchService(VenueRepository venueRepository) {
        this.venueRepository = venueRepository;
    }

    public PagedResponse<VenueSummaryDto> search(VenueSearchCriteria criteria, int page, int size, String sort) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), safeSize, sortOf(sort));

        Page<Venue> result = venueRepository.findAll(VenueSpecifications.matching(criteria), pageable);

        List<VenueSummaryDto> items = result.getContent().stream()
                .map(venue -> toSummary(venue, criteria))
                .toList();
        if ("distance".equalsIgnoreCase(sort) && criteria.nearLat() != null) {
            items = items.stream()
                    .sorted(Comparator.comparing(VenueSummaryDto::distanceKm,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
        }

        return new PagedResponse<>(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public VenueDetailDto getBySlug(String slug) {
        Venue venue = venueRepository.findBySlug(slug)
                .orElseThrow(() -> new VenueNotFoundException(slug));
        return toDetail(venue);
    }

    // ── mapping ──────────────────────────────────────────────────────────

    private VenueSummaryDto toSummary(Venue venue, VenueSearchCriteria criteria) {
        SportPricingRule cheapest = venue.getPricingRules().stream()
                .filter(SportPricingRule::isActive)
                .min(Comparator.comparing(SportPricingRule::getRate))
                .orElse(null);

        List<String> sports = venue.getPitches().stream()
                .flatMap(pitch -> pitch.getSports().stream())
                .map(Sport::getSlug)
                .distinct()
                .toList();

        Double distance = null;
        if (criteria != null && criteria.nearLat() != null && criteria.nearLng() != null
                && venue.getLat() != null && venue.getLng() != null) {
            distance = haversineKm(criteria.nearLat(), criteria.nearLng(), venue.getLat(), venue.getLng());
        }

        return new VenueSummaryDto(
                venue.getId(),
                venue.getSlug(),
                venue.getName(),
                venue.getArea(),
                venue.getAddress(),
                venue.getLat(),
                venue.getLng(),
                venue.getRatingAvg(),
                venue.getReviewCount(),
                venue.isVerified(),
                venue.getPromotionLabel(),
                amenityList(venue.getAmenities()),
                sports,
                cheapest == null ? null : cheapest.getRate(),
                cheapest == null ? null : cheapest.getSlotDurationMin(),
                distance);
    }

    private VenueDetailDto toDetail(Venue venue) {
        List<VenueDetailDto.PitchDto> pitches = venue.getPitches().stream()
                .filter(pitch -> pitch.isActive())
                .map(pitch -> new VenueDetailDto.PitchDto(
                        pitch.getId(), pitch.getName(), pitch.getFormat(), pitch.getSurfaceType(),
                        pitch.getLighting(), pitch.getMaxPlayers(), pitch.isIndoor(),
                        pitch.getSports().stream().map(Sport::getSlug).toList()))
                .toList();

        List<VenueDetailDto.PricingRuleDto> pricing = venue.getPricingRules().stream()
                .filter(SportPricingRule::isActive)
                .map(rule -> new VenueDetailDto.PricingRuleDto(
                        rule.getSport().getSlug(), rule.getWindowType(), rule.getRate(),
                        rule.getSlotDurationMin(), rule.getWindowStart(), rule.getWindowEnd()))
                .toList();

        return new VenueDetailDto(
                venue.getId(), venue.getSlug(), venue.getName(), venue.getArea(), venue.getAddress(),
                venue.getLat(), venue.getLng(), venue.getRatingAvg(), venue.getReviewCount(),
                venue.isVerified(), venue.getPromotionLabel(), amenityList(venue.getAmenities()),
                venue.getOpenTime(), venue.getCloseTime(), pitches, pricing);
    }

    private static Sort sortOf(String sort) {
        if (sort == null) {
            return Sort.by(Sort.Direction.DESC, "ratingAvg");
        }
        return switch (sort.toLowerCase()) {
            case "rating" -> Sort.by(Sort.Direction.DESC, "ratingAvg");
            case "name" -> Sort.by(Sort.Direction.ASC, "name");
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt");
            // distance is re-sorted in-memory after mapping
            default -> Sort.by(Sort.Direction.DESC, "ratingAvg");
        };
    }

    private static List<String> amenityList(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static double haversineKm(BigDecimal lat1, BigDecimal lng1, BigDecimal lat2, BigDecimal lng2) {
        double radLat1 = Math.toRadians(lat1.doubleValue());
        double radLat2 = Math.toRadians(lat2.doubleValue());
        double dLat = radLat2 - radLat1;
        double dLng = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double result = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(result * 10.0) / 10.0;
    }

    /** 404-mapped in the controller advice below. */
    public static class VenueNotFoundException extends RuntimeException {
        public VenueNotFoundException(String slug) {
            super("Venue not found: " + Objects.requireNonNullElse(slug, "?"));
        }
    }
}
