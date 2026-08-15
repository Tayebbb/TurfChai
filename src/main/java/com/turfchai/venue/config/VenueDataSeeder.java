package com.turfchai.venue.config;

import com.turfchai.model.User;
import com.turfchai.player.api.UserProfileRestController;
import com.turfchai.repository.UserRepository;
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
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * Test seed matching the sample venues (test profile only).
 */
@Configuration
@Profile({"dev", "test"})
public class VenueDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(VenueDataSeeder.class);

    @Bean
    @Order(2)   // after the demo player — venues need an owner user
    CommandLineRunner seedVenues(VenueRepository venues, SportRepository sports, UserRepository users) {
        return args -> seed(venues, sports, users);
    }

    @Transactional
    void seed(VenueRepository venues, SportRepository sports, UserRepository users) {
        if (venues.count() > 0) {
            return;
        }
        User owner = users.findByPublicId(UserProfileRestController.DEMO_USER_ID.toString()).orElse(null);

        Sport football = sport(sports, "Football", "football");
        Sport cricket = sport(sports, "Cricket", "cricket");
        Sport badminton = sport(sports, "Badminton", "badminton");
        Sport futsal = sport(sports, "Futsal", "futsal");
        Sport basketball = sport(sports, "Basketball", "basketball");

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
                new Seed("mirpur-sports-city", "Mirpur Sports City", "Mirpur DOHS", "Mirpur",
                        23.8370, 90.3630, 4.7, 301, true, "20% off after 10 PM",
                        "floodlights,cafeteria,parking", "11_a_side", List.of(football, cricket), 2200, 90),
                new Seed("gulshan-turf-park", "Gulshan Turf Park", "Gulshan-2, Dhaka", "Gulshan",
                        23.7805, 90.4150, 4.5, 167, true, "20% off-peak",
                        "floodlights,parking,cafeteria", "7_a_side", List.of(football, cricket), 2800, 90),
                new Seed("uttara-sports-complex", "Uttara Sports Complex", "Uttara Sector 7, Dhaka", "Uttara",
                        23.8759, 90.3995, 4.4, 132, true, null,
                        "floodlights,parking,changing_room", "11_a_side", List.of(football, cricket), 2400, 90),
                new Seed("bashundhara-arena", "Bashundhara Arena", "Bashundhara R/A, Dhaka", "Bashundhara",
                        23.8170, 90.4230, 4.3, 94, false, null,
                        "indoor,youth_friendly,cafeteria", "5_a_side", List.of(badminton, basketball), 1500, 60),
                new Seed("banani-futsal-hub", "Banani Futsal Hub", "Banani Block-F, Dhaka", "Banani",
                        23.7937, 90.4012, 4.6, 203, true, "Buy 5 get 1 free",
                        "floodlights,changing_room", "5_a_side", List.of(futsal, basketball), 2000, 60),
                new Seed("tejgaon-kick-zone", "Tejgaon Kick Zone", "Tejgaon Industrial Area, Dhaka", "Tejgaon",
                        23.7559, 90.3868, 4.2, 58, false, null,
                        "floodlights,parking", "7_a_side", List.of(football), 1900, 90),
                new Seed("khilgaon-sports-center", "Khilgaon Sports Center", "Khilgaon Taltola, Dhaka", "Khilgaon",
                        23.7559, 90.4354, 4.1, 46, false, null,
                        "indoor,youth_friendly", "5_a_side", List.of(badminton, basketball), 1300, 60),
                new Seed("rampura-play-ground", "Rampura Play Ground", "Rampura Bazar, Dhaka", "Rampura",
                        23.7672, 90.4261, 4.0, 39, false, "20% off-peak",
                        "floodlights,parking", "11_a_side", List.of(football, cricket), 1700, 90));

        Map<String, LocalTime[]> windows = Map.of(
                "OFF_PEAK", new LocalTime[] { LocalTime.of(6, 0), LocalTime.of(16, 0) },
                "PEAK", new LocalTime[] { LocalTime.of(16, 0), LocalTime.of(23, 0) });

        int venueNumber = 1000;
        for (Seed row : rows) {
            Venue venue = new Venue();
            venue.setSlug(row.slug());
            venue.setVenueCode("VEN-" + (++venueNumber));
            venue.setOwner(owner);
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
            venue.setStatus("LIVE");

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
                BigDecimal rate = BigDecimal.valueOf(
                        "OFF_PEAK".equals(window.getKey()) ? Math.round(row.price() * 0.8) : row.price());
                rule.setRate(rate);
                rule.setSlotDurationMin(row.duration());
                rule.setWindowStart(window.getValue()[0]);
                rule.setWindowEnd(window.getValue()[1]);
                venue.addPricingRule(rule);
            }
            venues.save(venue);
        }
        log.info("Seeded {} test venues", rows.size());
    }

    private static Sport sport(SportRepository sports, String name, String slug) {
        return sports.findBySlug(slug).orElseGet(() -> sports.save(new Sport(name, slug)));
    }
}
