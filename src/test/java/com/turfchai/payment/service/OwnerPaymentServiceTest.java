package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OwnerPaymentServiceTest {

    @Mock
    private VenueRepository venueRepository;

    @Mock
    private PitchRepository pitchRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private SlotRepository slotRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private OwnerPaymentService ownerPaymentService;

    private User ownerA;
    private User ownerB;
    private Venue venueA;
    private Venue venueB;
    private Pitch footballPitch;
    private Pitch cricketPitch;

    @BeforeEach
    void setUp() {
        ownerA = new User();
        ownerA.setId(101L);
        ownerA.setFullName("Owner Alpha");

        ownerB = new User();
        ownerB.setId(102L);
        ownerB.setFullName("Owner Beta");

        venueA = Venue.builder()
                .id(1L)
                .name("Alpha Turf")
                .owner(ownerA)
                .build();

        venueB = Venue.builder()
                .id(2L)
                .name("Beta Turf")
                .owner(ownerB)
                .build();

        Sport football = new Sport("Football", "football");
        footballPitch = new Pitch();
        footballPitch.setId(10L);
        footballPitch.setName("Pitch 1");
        footballPitch.setVenue(venueA);
        footballPitch.setSports(Set.of(football));
        footballPitch.setActive(true);

        Sport cricket = new Sport("Cricket", "cricket");
        cricketPitch = new Pitch();
        cricketPitch.setId(20L);
        cricketPitch.setName("Pitch 2");
        cricketPitch.setVenue(venueB);
        cricketPitch.setSports(Set.of(cricket));
        cricketPitch.setActive(true);
    }

    @Test
    @DisplayName("Owner with Football pitch only sees Football in configured sports filter")
    void testOwnerOnlySeesConfiguredSports() {
        when(venueRepository.findByOwnerId(101L)).thenReturn(List.of(venueA));
        when(pitchRepository.findByVenueIdInAndActiveTrue(List.of(1L))).thenReturn(List.of(footballPitch));
        when(bookingRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of());
        when(slotRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of());

        Map<String, Object> summary = ownerPaymentService.getPaymentSummary(101L, "daily");

        assertNotNull(summary);
        List<Map<String, String>> sports = (List<Map<String, String>>) summary.get("configuredSports");
        assertNotNull(sports);
        assertEquals(1, sports.size());
        assertEquals("Football", sports.get(0).get("name"));
    }

    @Test
    @DisplayName("Owner with no pitches gets empty sports list")
    void testOwnerWithNoPitchesGetsEmptySportsList() {
        when(venueRepository.findByOwnerId(101L)).thenReturn(List.of(venueA));
        when(pitchRepository.findByVenueIdInAndActiveTrue(List.of(1L))).thenReturn(List.of());
        when(pitchRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of());

        Map<String, Object> summary = ownerPaymentService.getPaymentSummary(101L, "daily");

        assertNotNull(summary);
        List<Map<String, String>> sports = (List<Map<String, String>>) summary.get("configuredSports");
        assertNotNull(sports);
        assertTrue(sports.isEmpty());
    }

    @Test
    @DisplayName("Reconciliation summary values are calculated accurately from bookings")
    void testReconciliationValuesCalculated() {
        Booking booking = Booking.builder()
                .id(1L)
                .bookingCode("BKG-1001")
                .venueId(1L)
                .pitchId(10L)
                .bookingDate(LocalDate.now())
                .grossAmount(new BigDecimal("2500"))
                .status(BookingStatus.CONFIRMED)
                .build();

        when(venueRepository.findByOwnerId(101L)).thenReturn(List.of(venueA));
        when(pitchRepository.findByVenueIdInAndActiveTrue(List.of(1L))).thenReturn(List.of(footballPitch));
        when(bookingRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of(booking));
        when(slotRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of());

        Map<String, Object> summary = ownerPaymentService.getPaymentSummary(101L, "daily");

        assertNotNull(summary);
        Map<String, Object> recon = (Map<String, Object>) summary.get("reconciliation");
        assertNotNull(recon);
        assertTrue(recon.get("onlineMatched").toString().contains("2500"));
    }

    @Test
    @DisplayName("Owner B cannot see Owner A's venues or financial metrics")
    void testStrictOwnerDataIsolation() {
        when(venueRepository.findByOwnerId(102L)).thenReturn(List.of(venueB));
        when(pitchRepository.findByVenueIdInAndActiveTrue(List.of(2L))).thenReturn(List.of(cricketPitch));
        when(bookingRepository.findByVenueIdIn(List.of(2L))).thenReturn(List.of());
        when(slotRepository.findByVenueIdIn(List.of(2L))).thenReturn(List.of());

        Map<String, Object> summaryB = ownerPaymentService.getPaymentSummary(102L, "daily");

        assertNotNull(summaryB);
        List<Map<String, String>> sportsB = (List<Map<String, String>>) summaryB.get("configuredSports");
        assertEquals(1, sportsB.size());
        assertEquals("Cricket", sportsB.get(0).get("name"));
        verify(venueRepository, never()).findByOwnerId(101L);
    }
}
