package com.turfchai.booking.config;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.repository.PitchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Seeds a handful of real, bookable {@code slots} rows for the H2 dev/test
 * profiles (mirrors {@code VenueDataSeeder}/{@code RewardDataSeeder}).
 * <p>
 * Nothing else creates slot rows — there's no slot-generation job and no
 * "list slots" REST endpoint yet, so without this the booking engine (which
 * is fully implemented and tested — see {@code BookingServiceTest} /
 * {@code BookingRestControllerTest} / {@code BookingConcurrencyIntegrationTest})
 * has no real data to hold/confirm/cancel against on a fresh database. This
 * only unblocks manual/API-level testing; the frontend's venue slot picker
 * still renders static mock times and needs its own follow-up to fetch real
 * slots and post real ids to {@code /api/v1/bookings/hold-slot}.
 */
@Configuration
@Profile({"dev", "test"})
public class SlotDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(SlotDataSeeder.class);

    @Bean
    @Order(3) // after venues/pitches exist
    CommandLineRunner seedSlots(PitchRepository pitches, SlotRepository slots) {
        return args -> seed(pitches, slots);
    }

    @Transactional
    void seed(PitchRepository pitches, SlotRepository slots) {
        if (slots.count() > 0) {
            return;
        }
        List<Pitch> allPitches = pitches.findAll();
        if (allPitches.isEmpty()) {
            return;
        }

        LocalTime[] startTimes = { LocalTime.of(7, 0), LocalTime.of(9, 30), LocalTime.of(16, 0),
                LocalTime.of(17, 30), LocalTime.of(19, 0), LocalTime.of(20, 30) };
        SlotStatus[] statusCycle = { SlotStatus.AVAILABLE, SlotStatus.AVAILABLE, SlotStatus.AVAILABLE,
                SlotStatus.BOOKED, SlotStatus.AVAILABLE, SlotStatus.AVAILABLE };

        int created = 0;
        for (Pitch pitch : allPitches) {
            for (LocalDate date : List.of(LocalDate.now(), LocalDate.now().plusDays(1))) {
                for (int i = 0; i < startTimes.length; i++) {
                    LocalTime start = startTimes[i];
                    boolean offPeak = start.isBefore(LocalTime.of(16, 0));
                    slots.save(Slot.builder()
                            .pitch(pitch)
                            .venueId(pitch.getVenue().getId())
                            .slotDate(date)
                            .price(offPeak ? BigDecimal.valueOf(2000) : BigDecimal.valueOf(2500))
                            .startTime(start)
                            .endTime(start.plusMinutes(90))
                            .status(statusCycle[i])
                            .build());
                    created++;
                }
            }
        }
        log.info("Seeded {} bookable slots across {} pitches", created, allPitches.size());
    }
}
