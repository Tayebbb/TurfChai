package com.turfchai.integrity;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.OwnerAnalyticsService;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The owner dashboard reported "100%" occupancy for every venue, on every day,
 * whatever the slots said. These tests pin the figure to the slot table so the
 * literal cannot come back unnoticed.
 */
@SpringBootTest
@ActiveProfiles({"test", "dev"})
@Transactional
class OwnerDashboardOccupancyTest {

    @Autowired OwnerAnalyticsService ownerAnalyticsService;
    @Autowired VenueRepository venueRepository;
    @Autowired PitchRepository pitchRepository;
    @Autowired SlotRepository slotRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired UserRepository userRepository;

    private Venue venue;
    private Pitch pitch;

    @BeforeEach
    void setUp() {
        User owner = userRepository.save(User.builder()
                .fullName("Occupancy Owner")
                .email("occupancy.owner." + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + java.util.concurrent.ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(com.turfchai.model.enums.RoleType.OWNER)
                .build());

        venue = venueRepository.save(Venue.builder()
                .slug("occupancy-arena-" + System.nanoTime())
                .name("Occupancy Arena")
                .area("Dhanmondi")
                .address("1 Test Road")
                .owner(owner)
                .status("LIVE")
                .basePrice(BigDecimal.valueOf(2000))
                .build());

        Pitch newPitch = new Pitch();
        newPitch.setVenue(venue);
        newPitch.setName("Pitch 1");
        newPitch.setMaxPlayers(14);
        pitch = pitchRepository.save(newPitch);
    }

    private Slot slot(LocalTime start, SlotStatus status) {
        Slot slot = new Slot();
        slot.setPitch(pitch);
        slot.setVenueId(venue.getId());
        slot.setSlotDate(LocalDate.now());
        slot.setStartTime(start);
        slot.setEndTime(start.plusHours(1));
        slot.setPrice(BigDecimal.valueOf(2000));
        slot.setStatus(status);
        return slotRepository.save(slot);
    }

    @SuppressWarnings("unchecked")
    private String occupancyValue() {
        Map<String, Object> dashboard = ownerAnalyticsService.getDashboardData(venue.getOwner().getId());
        List<Map<String, Object>> kpis = (List<Map<String, Object>>) dashboard.get("kpis");
        return kpis.stream()
                .filter(kpi -> "Occupancy".equals(kpi.get("label")))
                .map(kpi -> String.valueOf(kpi.get("value")))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void reportsTheRealShareOfBookedSlots() {
        slot(LocalTime.of(18, 0), SlotStatus.BOOKED);
        slot(LocalTime.of(19, 0), SlotStatus.AVAILABLE);
        slot(LocalTime.of(20, 0), SlotStatus.AVAILABLE);
        slot(LocalTime.of(21, 0), SlotStatus.AVAILABLE);

        assertThat(occupancyValue()).isEqualTo("25%");
    }

    @Test
    void reportsZeroWhenNothingIsBooked() {
        slot(LocalTime.of(18, 0), SlotStatus.AVAILABLE);
        slot(LocalTime.of(19, 0), SlotStatus.AVAILABLE);

        assertThat(occupancyValue()).isEqualTo("0%");
    }

    @Test
    void refusesToInventAFigureWhenNoSlotsArePublished() {
        assertThat(occupancyValue()).isEqualTo("\u2014");
    }

    @Test
    void reportsFullOnlyWhenEverySlotIsActuallyTaken() {
        slot(LocalTime.of(18, 0), SlotStatus.BOOKED);
        slot(LocalTime.of(19, 0), SlotStatus.BOOKED);

        assertThat(occupancyValue()).isEqualTo("100%");
    }

    @Test
    @SuppressWarnings("unchecked")
    void activityRowsAreNotAllStampedJustNow() {
        Slot booked = slot(LocalTime.of(18, 0), SlotStatus.BOOKED);
        Booking booking = new Booking();
        booking.setVenueId(venue.getId());
        booking.setPitchId(pitch.getId());
        booking.setSlot(booked);
        booking.setUserId(venue.getOwner().getId());
        booking.setBookingCode("TC-" + (System.nanoTime() % 100_000_000L));
        booking.setBookingDate(LocalDate.now());
        booking.setStartTime(LocalTime.of(18, 0));
        booking.setEndTime(LocalTime.of(19, 0));
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setGrossAmount(BigDecimal.valueOf(2000));
        booking.setNetAmount(BigDecimal.valueOf(2000));
        booking = bookingRepository.save(booking);
        booking.setCreatedAt(java.time.OffsetDateTime.now().minusDays(3));
        bookingRepository.saveAndFlush(booking);

        Map<String, Object> dashboard = ownerAnalyticsService.getDashboardData(venue.getOwner().getId());
        List<Map<String, Object>> activity = (List<Map<String, Object>>) dashboard.get("activity");

        assertThat(activity).isNotEmpty();
        String detail = String.valueOf(activity.get(0).get("detail"));
        assertThat(detail).contains("3 days ago");
        assertThat(detail).doesNotContain("Just now");
    }

    /**
     * "Today" on this dashboard means played today. It used to also mean created
     * today, so a booking sold now for next week landed in today's takings — and
     * would be counted again on the day it was actually played, beside an
     * Occupancy figure that (correctly) saw nothing booked for today.
     */
    @Test
    @SuppressWarnings("unchecked")
    void aBookingSoldTodayForALaterDateIsNotTodaysTrade() {
        Slot future = new Slot();
        future.setPitch(pitch);
        future.setVenueId(venue.getId());
        future.setSlotDate(LocalDate.now().plusDays(4));
        future.setStartTime(LocalTime.of(18, 0));
        future.setEndTime(LocalTime.of(19, 0));
        future.setPrice(BigDecimal.valueOf(2000));
        future.setStatus(SlotStatus.BOOKED);
        future = slotRepository.save(future);

        Booking booking = new Booking();
        booking.setVenueId(venue.getId());
        booking.setPitchId(pitch.getId());
        booking.setSlot(future);
        booking.setUserId(venue.getOwner().getId());
        booking.setBookingCode("TC-" + (System.nanoTime() % 100_000_000L));
        booking.setBookingDate(LocalDate.now().plusDays(4));
        booking.setStartTime(LocalTime.of(18, 0));
        booking.setEndTime(LocalTime.of(19, 0));
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setGrossAmount(BigDecimal.valueOf(2000));
        booking.setNetAmount(BigDecimal.valueOf(2000));
        bookingRepository.saveAndFlush(booking);

        Map<String, Object> dashboard = ownerAnalyticsService.getDashboardData(venue.getOwner().getId());
        List<Map<String, Object>> kpis = (List<Map<String, Object>>) dashboard.get("kpis");
        String revenue = kpis.stream().filter(k -> "Today's revenue".equals(k.get("label")))
                .map(k -> String.valueOf(k.get("value"))).findFirst().orElseThrow();
        String count = kpis.stream().filter(k -> "Bookings today".equals(k.get("label")))
                .map(k -> String.valueOf(k.get("value"))).findFirst().orElseThrow();

        assertThat(revenue).isEqualTo("\u09f30");
        assertThat(count).isEqualTo("0");
    }
}
