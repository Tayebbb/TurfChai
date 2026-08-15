package com.turfchai.booking.api;

import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The public venue slot listing generates bookable slots on demand — there is
 * no generation job, and the startup seeder only covers today/tomorrow, so a
 * date without rows used to come back empty and the venue page could show
 * nothing to select for the rest of the 7-day strip.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SlotRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private VenueRepository venueRepository;

    @Autowired
    private PitchRepository pitchRepository;

    @Autowired
    private SlotRepository slotRepository;

    private Venue venue;
    private Pitch pitch;

    /** A date the startup seeder (today/tomorrow) will never have covered. */
    private static LocalDate unsownDate() {
        return LocalDate.now().plusDays(3);
    }

    @BeforeEach
    void setUp() {
        venue = venueRepository.save(Venue.builder()
                .slug("slot-venue-" + System.nanoTime())
                .name("Slot Venue")
                .address("Test Address")
                .area("Test Area")
                .build());
        pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch A");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitchRepository.save(pitch);
    }

    @Test
    void listSlots_generatesBookableSlotsForAnUnsownDate() throws Exception {
        LocalDate date = unsownDate();

        mockMvc.perform(get("/api/v1/venues/{venueId}/slots?date={date}", venue.getId(), date))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].status").value(SlotStatus.AVAILABLE.name()))
                .andExpect(jsonPath("$[0].pitchId").value(pitch.getId()));

        List<?> persisted = slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venue.getId(), date);
        assertThat(persisted).hasSize(6);
        assertThat(slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venue.getId(), date))
                .allMatch(slot -> slot.getStatus() == SlotStatus.AVAILABLE);
    }

    @Test
    void listSlots_isIdempotentAcrossRequests() throws Exception {
        LocalDate date = unsownDate();

        MvcResult first = mockMvc.perform(get("/api/v1/venues/{venueId}/slots?date={date}", venue.getId(), date))
                .andExpect(status().isOk())
                .andReturn();
        int firstCount = first.getResponse().getContentAsString().split("\"id\"", -1).length - 1;

        mockMvc.perform(get("/api/v1/venues/{venueId}/slots?date={date}", venue.getId(), date))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(firstCount));

        // A second request must not duplicate rows.
        assertThat(slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venue.getId(), date)).hasSize(firstCount);
    }
}