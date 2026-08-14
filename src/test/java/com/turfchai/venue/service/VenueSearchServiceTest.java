package com.turfchai.venue.service;

import com.turfchai.venue.VenueTestData;
import com.turfchai.venue.dto.PagedResponse;
import com.turfchai.venue.dto.VenueDetailDto;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@org.springframework.test.context.ActiveProfiles({"test", "dev"})
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:venue-search-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class VenueSearchServiceTest {

    @Autowired
    private VenueSearchService service;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private SportRepository sports;
    @Autowired
    private com.turfchai.tournament.repository.TournamentRepository tournaments;

    private Sport football;
    private Sport badminton;

    @BeforeEach
    void setUp() {
        // The demo tournament seeder references venue pitches — clear it
        // first so the venue reset below doesn't hit FK constraints.
        tournaments.deleteAll();
        venues.deleteAll();
        football = VenueTestData.sport(sports, "football");
        badminton = VenueTestData.sport(sports, "badminton");

        VenueTestData.venue(venues, "alpha-arena", "Dhanmondi", 4.8, true,
                "floodlights,parking", 2500, football);
        VenueTestData.venue(venues, "beta-turf", "Mirpur", 4.2, false,
                "floodlights", 1500, football);
        VenueTestData.venue(venues, "gamma-court", "Dhanmondi", 4.5, true,
                "indoor,changing_room", 600, badminton);
    }

    private static VenueSearchCriteria criteria(String area, String sport, BigDecimal min, BigDecimal max,
            List<String> amenities, Boolean verified) {
        return new VenueSearchCriteria(null, area, sport, min, max, amenities, verified, null, null, null, null);
    }

    @Test
    void filtersByArea() {
        PagedResponse<VenueSummaryDto> result = service.search(
                criteria("Dhanmondi", null, null, null, null, null), 0, 10, "rating");
        assertThat(result.items()).extracting(v -> v.slug())
                .containsExactlyInAnyOrder("alpha-arena", "gamma-court");
    }

    @Test
    void filtersBySport() {
        PagedResponse<VenueSummaryDto> result = service.search(
                criteria(null, "badminton", null, null, null, null), 0, 10, "rating");
        assertThat(result.items()).extracting(v -> v.slug()).containsExactly("gamma-court");
    }

    @Test
    void filtersByPriceRange() {
        PagedResponse<VenueSummaryDto> result = service.search(
                criteria(null, null, BigDecimal.valueOf(1000), BigDecimal.valueOf(2000), null, null),
                0, 10, "rating");
        assertThat(result.items()).extracting(v -> v.slug()).containsExactly("beta-turf");
    }

    @Test
    void filtersByAmenitiesAndVerified() {
        PagedResponse<VenueSummaryDto> result = service.search(
                criteria(null, null, null, null, List.of("floodlights"), true), 0, 10, "rating");
        assertThat(result.items()).extracting(v -> v.slug()).containsExactly("alpha-arena");
    }

    @Test
    void freeTextQueryMatchesNameAndArea() {
        VenueSearchCriteria byName = new VenueSearchCriteria(
                "gamma", null, null, null, null, null, null, null, null, null, null);
        assertThat(service.search(byName, 0, 10, "rating").items())
                .extracting(v -> v.slug()).containsExactly("gamma-court");
    }

    @Test
    void openAtFilterRespectsOperatingHours() {
        VenueSearchCriteria lateNight = new VenueSearchCriteria(
                null, null, null, null, null, null, null, LocalTime.of(23, 30), null, null, null);
        assertThat(service.search(lateNight, 0, 10, "rating").items()).isEmpty();
    }

    @Test
    void sortsByRatingByDefaultAndPaginates() {
        PagedResponse<VenueSummaryDto> page0 = service.search(
                criteria(null, null, null, null, null, null), 0, 2, "rating");
        assertThat(page0.items()).hasSize(2);
        assertThat(page0.totalItems()).isEqualTo(3);
        assertThat(page0.totalPages()).isEqualTo(2);
        assertThat(page0.items().get(0).slug()).isEqualTo("alpha-arena"); // 4.8 first
    }

    @Test
    void summaryCarriesFromPriceAndSports() {
        VenueSummaryDto alpha = service.search(
                criteria("Dhanmondi", "football", null, null, null, null), 0, 10, "rating")
                .items().get(0);
        assertThat(alpha.fromPrice()).isEqualByComparingTo(BigDecimal.valueOf(2500));
        assertThat(alpha.sports()).contains("football");
        assertThat(alpha.amenities()).contains("floodlights", "parking");
    }

    @Test
    void detailLookupBySlugIncludesPitchesAndPricing() {
        VenueDetailDto detail = service.getBySlug("alpha-arena");
        assertThat(detail.pitches()).hasSize(1);
        assertThat(detail.pitches().get(0).sports()).containsExactly("football");
        assertThat(detail.pricing()).hasSize(1);
    }

    @Test
    void unknownSlugRaisesNotFound() {
        assertThatThrownBy(() -> service.getBySlug("nope"))
                .isInstanceOf(VenueSearchService.VenueNotFoundException.class);
    }

    @Test
    void complexSearchPerformanceStaysBounded() {
        // seed 200 more venues, then assert a fully-loaded filter query is fast
        for (int i = 0; i < 200; i++) {
            VenueTestData.venue(venues, "perf-venue-" + i, i % 2 == 0 ? "Dhanmondi" : "Uttara",
                    3.5 + (i % 15) / 10.0, i % 3 == 0, "floodlights,parking", 1000 + i * 10, football);
        }
        VenueSearchCriteria heavy = new VenueSearchCriteria(
                "venue", "Dhanmondi", "football", BigDecimal.valueOf(1200), BigDecimal.valueOf(2800),
                List.of("floodlights"), null, null, null, null, null);

        long start = System.nanoTime();
        PagedResponse<VenueSummaryDto> result = service.search(heavy, 0, 20, "rating");
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertThat(result.items()).isNotEmpty();
        assertThat(elapsedMs).isLessThan(1500);
    }
}
