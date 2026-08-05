package com.turfchai.venue;

import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/** Shared fixture builders for venue tests. */
public final class VenueTestData {

    private VenueTestData() {
    }

    public static Sport sport(SportRepository sports, String slug) {
        return sports.findBySlug(slug)
                .orElseGet(() -> sports.save(new Sport(slug.substring(0, 1).toUpperCase() + slug.substring(1), slug)));
    }

    public static Venue venue(VenueRepository venues, String slug, String area, double rating,
            boolean verified, String amenities, int peakPrice, Sport... sportList) {
        Venue venue = new Venue();
        venue.setSlug(slug);
        venue.setName(slug.replace('-', ' '));
        venue.setAddress("Test address, " + area);
        venue.setArea(area);
        venue.setLat(BigDecimal.valueOf(23.75));
        venue.setLng(BigDecimal.valueOf(90.37));
        venue.setRatingAvg(BigDecimal.valueOf(rating));
        venue.setReviewCount(10);
        venue.setVerified(verified);
        venue.setAmenities(amenities);

        Pitch pitch = new Pitch();
        pitch.setName("Pitch 1");
        pitch.setFormat("7_a_side");
        pitch.getSports().addAll(List.of(sportList));
        venue.addPitch(pitch);

        SportPricingRule rule = new SportPricingRule();
        rule.setSport(sportList[0]);
        rule.setWindowType("PEAK");
        rule.setRate(BigDecimal.valueOf(peakPrice));
        rule.setSlotDurationMin(90);
        rule.setWindowStart(LocalTime.of(16, 0));
        rule.setWindowEnd(LocalTime.of(23, 0));
        venue.addPricingRule(rule);

        return venues.save(venue);
    }
}
