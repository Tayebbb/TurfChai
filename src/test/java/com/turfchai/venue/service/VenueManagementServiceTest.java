package com.turfchai.venue.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.venue.dto.owner.OwnerCalendarDto;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.SportPricingRuleRepository;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;
import com.turfchai.venue.dto.owner.UpdateVenueRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VenueManagementServiceTest {

    @Mock
    private VenueRepository venueRepository;

    @Mock
    private PitchRepository pitchRepository;

    @Mock
    private SlotRepository slotRepository;

    @Mock
    private com.turfchai.booking.repository.BookingRepository bookingRepository;

    @Mock
    private com.turfchai.repository.UserRepository userRepository;

    @Mock
    private SportPricingRuleRepository pricingRuleRepository;

    @Mock
    private SportRepository sportRepository;

    @Mock
    private com.turfchai.booking.service.SlotTimePolicy slotTimePolicy;

    @Mock
    private com.turfchai.pricing.service.PricingInferenceService pricingInferenceService;

    @Mock
    private SlotPricingRuleEngine pricingEngine;

    @Mock
    private com.turfchai.repository.TurfRequestRepository turfRequestRepository;

    @InjectMocks
    private VenueManagementService venueManagementService;

    private User owner1;
    private User owner2;
    private Venue venue1;
    private Venue venue2;
    private Pitch pitch1;

    @BeforeEach
    void setUp() {
        owner1 = User.builder().id(10L).email("owner1@turfchai.com").fullName("Owner 1").build();
        owner2 = User.builder().id(20L).email("owner2@turfchai.com").fullName("Owner 2").build();

        venue1 = Venue.builder().id(100L).owner(owner1).name("Owner 1 Arena").build();
        venue2 = Venue.builder().id(200L).owner(owner2).name("Owner 2 Arena").build();

        pitch1 = new Pitch();
        pitch1.setId(1001L);
        pitch1.setName("Pitch Alpha");
        pitch1.setFormat("7-a-side");
        pitch1.setActive(true);
    }

    @Test
    @DisplayName("Owner can see their own pitches in calendar")
    void testGetOwnerCalendar_OwnerPitches() {
        when(venueRepository.findByOwnerId(10L)).thenReturn(List.of(venue1));
        when(pitchRepository.findByVenueIdAndActiveTrue(100L)).thenReturn(List.of(pitch1));
        when(slotRepository.save(any(Slot.class))).thenAnswer(i -> i.getArgument(0));
        when(slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(eq(100L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(bookingRepository.findByVenueIdInAndBookingDate(anyList(), any(LocalDate.class)))
                .thenReturn(List.of());

        OwnerCalendarDto result = venueManagementService.getOwnerCalendar(10L, 100L, LocalDate.now());

        assertNotNull(result);
        assertEquals(100L, result.getVenueId());
        assertEquals("Owner 1 Arena", result.getVenueName());
        assertEquals(1, result.getPitches().size());
        assertEquals("Pitch Alpha", result.getPitches().get(0).getName());
    }

    @Test
    @DisplayName("Owner cannot see another owner's pitches (Strict Owner Isolation)")
    void testGetOwnerCalendar_StrictOwnerIsolation() {
        // Owner 1 requests calendar for venue 200 (owned by Owner 2)
        when(venueRepository.findByOwnerId(10L)).thenReturn(List.of(venue1));
        when(pitchRepository.findByVenueIdAndActiveTrue(100L)).thenReturn(List.of(pitch1));
        when(slotRepository.save(any(Slot.class))).thenAnswer(i -> i.getArgument(0));
        when(bookingRepository.findByVenueIdInAndBookingDate(anyList(), any(LocalDate.class)))
                .thenReturn(List.of());

        OwnerCalendarDto result = venueManagementService.getOwnerCalendar(10L, 200L, LocalDate.now());

        // Must fall back to Owner 1's venue or empty, NOT returning Owner 2's venue
        assertEquals(100L, result.getVenueId());
        assertEquals("Owner 1 Arena", result.getVenueName());
    }

    @Test
    @DisplayName("No pitches returns empty pitch state")
    void testGetOwnerCalendar_NoPitchesReturnsEmptyState() {
        when(venueRepository.findByOwnerId(10L)).thenReturn(List.of(venue1));
        when(pitchRepository.findByVenueIdAndActiveTrue(100L)).thenReturn(List.of());
        when(pitchRepository.findByVenueId(100L)).thenReturn(List.of());

        OwnerCalendarDto result = venueManagementService.getOwnerCalendar(10L, 100L, LocalDate.now());

        assertNotNull(result);
        assertEquals(100L, result.getVenueId());
        assertTrue(result.getPitches().isEmpty());
        assertTrue(result.getRows().isEmpty());
    }

    @Test
    @DisplayName("Owner can block an available slot")
    void testBlockSlot_Success() {
        Slot slot = Slot.builder()
                .id(500L)
                .venueId(100L)
                .slotDate(LocalDate.now())
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .status(SlotStatus.AVAILABLE)
                .build();

        when(slotRepository.findById(500L)).thenReturn(Optional.of(slot));
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        venueManagementService.blockSlot(10L, 100L, 500L);

        assertEquals(SlotStatus.BLOCKED, slot.getStatus());
        verify(slotRepository, times(1)).save(slot);
    }

    @Test
    @DisplayName("Owner can unblock a blocked slot")
    void testUnblockSlot_Success() {
        Slot slot = Slot.builder()
                .id(500L)
                .venueId(100L)
                .slotDate(LocalDate.now())
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .status(SlotStatus.BLOCKED)
                .build();

        when(slotRepository.findById(500L)).thenReturn(Optional.of(slot));
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        venueManagementService.unblockSlot(10L, 100L, 500L);

        assertEquals(SlotStatus.AVAILABLE, slot.getStatus());
        verify(slotRepository, times(1)).save(slot);
    }

    @Test
    @DisplayName("Invalid owner/pitch combination is rejected with SecurityException")
    void testBlockSlot_CrossOwnerAttemptRejected() {
        Slot slot = Slot.builder()
                .id(500L)
                .venueId(100L) // Venue 100 belongs to Owner 1 (10L)
                .status(SlotStatus.AVAILABLE)
                .build();

        when(slotRepository.findById(500L)).thenReturn(Optional.of(slot));
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        // Owner 2 (20L) tries to block Owner 1's slot
        assertThrows(SecurityException.class, () -> venueManagementService.blockSlot(20L, 100L, 500L));
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("Cannot block an already booked slot")
    void testBlockSlot_BookedSlotRejected() {
        Slot slot = Slot.builder()
                .id(500L)
                .venueId(100L)
                .status(SlotStatus.BOOKED)
                .build();

        when(slotRepository.findById(500L)).thenReturn(Optional.of(slot));
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        assertThrows(IllegalArgumentException.class, () -> venueManagementService.blockSlot(10L, 100L, 500L));
        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("Owner can add venue photo URL and persist to venue record")
    void testAddVenuePhoto_Success() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));
        when(venueRepository.save(any(Venue.class))).thenAnswer(i -> i.getArgument(0));

        var result = venueManagementService.addVenuePhoto(10L, 100L,
                "https://res.cloudinary.com/demo/image/upload/v1/venue1.jpg");

        assertNotNull(result);
        assertEquals("https://res.cloudinary.com/demo/image/upload/v1/venue1.jpg", venue1.getPhotos());
        verify(venueRepository).save(venue1);
    }

    @Test
    @DisplayName("Owner can update venue status to LIVE or OFFLINE")
    void testUpdateVenueStatus_Success() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));
        when(venueRepository.save(any(Venue.class))).thenAnswer(i -> i.getArgument(0));

        var result = venueManagementService.updateVenueStatus(10L, 100L, "LIVE");

        assertNotNull(result);
        assertEquals("LIVE", venue1.getStatus());
        verify(venueRepository).save(venue1);
    }

    @Test
    @DisplayName("requireOwnership throws VenueNotFoundException when venue ID does not exist")
    void testRequireOwnership_VenueNotFoundThrowsVenueNotFoundException() {
        when(venueRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(com.turfchai.exception.VenueNotFoundException.class,
                () -> venueManagementService.requireOwnership(10L, 999L));
    }

    @Test
    @DisplayName("requireOwnership throws SecurityException when user does not own venue")
    void testRequireOwnership_OtherOwnerThrowsSecurityException() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        assertThrows(SecurityException.class, () -> venueManagementService.requireOwnership(999L, 100L));
    }

    /** Builds an UpdateVenueRequest that only carries the two policy fields. */
    private static com.turfchai.venue.dto.owner.UpdateVenueRequest policyRequest(String cancel, String deposit) {
        return new com.turfchai.venue.dto.owner.UpdateVenueRequest(
                null, null, null, null, null, null, null, null, null, null,
                deposit, cancel, null, null, null, null, null, null, null, null);
    }

    /**
     * The venue table constrains these columns to a fixed vocabulary
     * (ck_venues_cancel / ck_venues_deposit in V1__baseline.sql). The owner UI
     * used to post the human-readable label instead, which is both too long for
     * VARCHAR(30) and outside the check constraint, so the write failed and the
     * refund engine silently kept applying the old policy.
     */
    @Test
    @DisplayName("A display label is rejected instead of being written to a constrained column")
    void testUpdateVenue_DisplayLabelPolicyRejected() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));

        assertThrows(IllegalArgumentException.class, () -> venueManagementService.updateVenue(
                10L, 100L,
                policyRequest("Free cancel until 24h before \u00b7 50% within 24h \u00b7 no refund within 6h", null)));
        assertThrows(IllegalArgumentException.class, () -> venueManagementService.updateVenue(
                10L, 100L, policyRequest(null, "30% deposit up front")));
        verify(venueRepository, never()).save(any(Venue.class));
    }

    @Test
    @DisplayName("The real policy vocabulary is accepted and stored")
    void testUpdateVenue_RealPolicyVocabularyAccepted() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));
        when(venueRepository.save(any(Venue.class))).thenAnswer(i -> i.getArgument(0));

        venueManagementService.updateVenue(10L, 100L, policyRequest("strict_no_refund", "  FIFTY_PERCENT "));

        assertEquals("STRICT_NO_REFUND", venue1.getCancelPolicy());
        assertEquals("FIFTY_PERCENT", venue1.getDepositPolicy());
    }

    /**
     * Listing venues used to invent one - "Kick Off Arena", Dhanmondi, ৳2000 -
     * when the owner had none, so a brand-new owner was shown a turf they had
     * never created, and a GET wrote to the database. A venue is created only
     * when an admin approves the owner's turf request.
     */
    @Test
    @DisplayName("An owner with no venues gets an empty list, and nothing is written")
    void testListOwnerVenues_InventsNothing() {
        when(venueRepository.findByOwnerId(10L)).thenReturn(List.of());
        when(userRepository.findById(10L)).thenReturn(Optional.of(owner1));
        when(turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(turfRequestRepository.findByOwnerEmailOrderByCreatedAtDesc(owner1.getEmail())).thenReturn(List.of());

        var result = venueManagementService.listOwnerVenues(10L);

        assertTrue(result.isEmpty(), "an owner who created nothing owns nothing");
        verify(venueRepository, never()).save(any(Venue.class));
    }

    @Test
    @DisplayName("Toggling mlPricingEnabled updates venue and triggers upcoming slot repricing")
    void testUpdateVenue_MlPricingEnabledToggle() {
        when(venueRepository.findById(100L)).thenReturn(Optional.of(venue1));
        when(venueRepository.save(any(Venue.class))).thenAnswer(i -> i.getArgument(0));
        when(slotRepository.findUpcomingAvailableSlots(eq(100L), any(), any())).thenReturn(List.of());

        var updateReq = new UpdateVenueRequest(
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, false, null
        );

        venue1.setMlPricingEnabled(true);
        var res = venueManagementService.updateVenue(10L, 100L, updateReq);

        assertFalse(venue1.isMlPricingEnabled());
        assertFalse(res.mlPricingEnabled());
        verify(slotRepository).findUpcomingAvailableSlots(eq(100L), any(), any());
    }
}
