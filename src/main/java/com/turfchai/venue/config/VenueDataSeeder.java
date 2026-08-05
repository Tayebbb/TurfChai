package com.turfchai.venue.config;

import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * Dev seed matching the frontend prototype's Dhaka sample venues.
 * Runs only when the venues table is empty; replaced by real owner
 * onboarding + Flyway seeds later.
 */
@Configuration
public class VenueDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(VenueDataSeeder.class);

    @Bean
    @Order(1)   // venues first — player and tournament seeders depend on them
    CommandLineRunner seedVenues(VenueRepository venues, SportRepository sports) {
        return args -> seed(venues, sports);
    }

    @Transactional
    void seed(VenueRepository venues, SportRepository sports) {
        if (venues.count() > 0) {
            return;
        }

        Sport football = sports.save(new Sport("Football", "football"));
        Sport cricket = sports.save(new Sport("Cricket", "cricket"));
        Sport badminton = sports.save(new Sport("Badminton", "badminton"));
        Sport futsal = sports.save(new Sport("Futsal", "futsal"));

        record Seed(String slug, String name, String address, String area, double lat, double lng,
                double rating, int reviews, boolean verified, String promo, String amenities,
                String format, List<Sport> sportList, int price, int duration) {
        }

        List<Seed> rows = List.of(
                new Seed("kick-off-arena", "Kick Off Arena", "Road 27, Dhanmondi", "Dhanmondi",
                        23.7461, 90.3742, 4.8, 214, true, null,
                        "floodlights,parking,changing_room", "7_a_side", List.of(football, futsal), 2500, 90),
                new Seed("greenturf-mohammadpur", "GreenTurf Mohammadpur", "Ring Road, Mohammadpur", "Mohammadpur",
                        23.7658, 90.3589, 4.6, 128, true, "Buy 5 get 1 free",
                        "floodlights,changing_room", "6_a_side", List.of(football), 1800, 60),
                new Seed("lalmatia-play-zone", "Lalmatia Play Zone", "Block D, Lalmatia", "Lalmatia",
                        23.7551, 90.3668, 4.3, 64, false, null,
                        "indoor,youth_friendly", "5_a_side", List.of(football, futsal), 1500, 60),
                new Seed("mirpur-sports-city", "Mirpur Sports City", "Mirpur DOHS", "Mirpur",
                        23.8370, 90.3630, 4.7, 301, true, "20% off after 10 PM",
                        "floodlights,cafeteria,parking", "11_a_side", List.of(football, cricket), 2200, 90),
                new Seed("shuttlezone-lalmatia", "ShuttleZone Lalmatia", "Block B, Lalmatia", "Lalmatia",
                        23.7543, 90.3702, 4.5, 89, false, null,
                        "indoor,changing_room", "5_a_side", List.of(badminton), 600, 60),
                new Seed("baridhara-sports-hub", "Baridhara Sports Hub", "Park Road, Baridhara", "Baridhara",
                        23.8103, 90.4224, 4.9, 86, true, "20% off-peak",
                        "floodlights,parking,cafeteria", "7_a_side", List.of(football, cricket), 3200, 90));

        Map<String, LocalTime[]> windows = Map.of(
                "off_peak", new LocalTime[] { LocalTime.of(6, 0), LocalTime.of(16, 0) },
                "peak", new LocalTime[] { LocalTime.of(16, 0), LocalTime.of(23, 0) });

        for (Seed row : rows) {
            Venue venue = new Venue();
            venue.setSlug(row.slug());
            venue.setName(row.name());
            venue.setAddress(row.address());
            venue.setArea(row.area());
            venue.setLat(BigDecimal.valueOf(row.lat()));
            venue.setLng(BigDecimal.valueOf(row.lng()));
            venue.setRatingAvg(BigDecimal.valueOf(row.rating()));
            venue.setReviewCount(row.reviews());
            venue.setVerified(row.verified());
            venue.setPromotionLabel(row.promo());
            venue.setAmenities(row.amenities());

            Pitch pitch = new Pitch();
            pitch.setName("Pitch 1");
            pitch.setFormat(row.format());
            pitch.setSurfaceType(row.amenities().contains("indoor") ? "Indoor court" : "Artificial grass");
            pitch.setLighting("LED floodlights");
            pitch.setMaxPlayers(16);
            pitch.setIndoor(row.amenities().contains("indoor"));
            pitch.getSports().addAll(row.sportList());
            venue.addPitch(pitch);

            for (Map.Entry<String, LocalTime[]> window : windows.entrySet()) {
                SportPricingRule rule = new SportPricingRule();
                rule.setSport(row.sportList().get(0));
                rule.setWindowType(window.getKey());
                // off-peak is 20% cheaper than the listed (peak) price
                BigDecimal rate = BigDecimal.valueOf(
                        "off_peak".equals(window.getKey()) ? Math.round(row.price() * 0.8) : row.price());
                rule.setRate(rate);
                rule.setSlotDurationMin(row.duration());
                rule.setWindowStart(window.getValue()[0]);
                rule.setWindowEnd(window.getValue()[1]);
                venue.addPricingRule(rule);
            }
            venues.save(venue);
        }
        log.info("Seeded {} demo venues", rows.size());
    }
}
