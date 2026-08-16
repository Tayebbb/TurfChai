package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.event.SlotStatusChangedEvent;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private SlotRepository slotRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private com.turfchai.venue.repository.VenueRepository venueRepository;
    @Mock
    private ApplicationEventPublisher events;
    @Mock
    private com.turfchai.service.NotificationService notificationService;

    /** Real policy, not a mock: these tests must exercise the actual time rules. */
    @Spy
    private SlotTimePolicy slotTimePolicy = new SlotTimePolicy();

    @InjectMocks
    private BookingService bookingService;

    private static final Long USER_ID = 42L;
    private static final Long OTHER_USER_ID = 99L;
    private static final Long SLOT_ID = 1L;

    private Slot slot;

    @BeforeEach
    void setUp() {
        slot = Slot.builder()
                .id(SLOT_ID)
                .status(SlotStatus.AVAILABLE)
                .build();
    }

    @Test
    @DisplayName("holdSlot succeeds on an AVAILABLE slot")
    void holdSlot_succeeds_whenAvailable() {
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        bookingService.holdSlot(USER_ID, SLOT_ID);

        assertEquals(SlotStatus.HELD, slot.getStatus());
        assertEquals(USER_ID, slot.getHeldByUserId());
        assertNotNull(slot.getHoldExpiresAt());
        assertTrue(slot.getHoldExpiresAt().isAfter(OffsetDateTime.now()));
        verify(slotRepository).save(slot);
    }

    @Test
    @DisplayName("holdSlot fails when another user holds an active hold")
    void holdSlot_fails_whenActiveHoldPresent() {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(OTHER_USER_ID);
        slot.setHoldExpiresAt(OffsetDateTime.now().plusMinutes(4));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        assertThrows(SlotUnavailableException.class, () -> bookingService.holdSlot(USER_ID, SLOT_ID));

        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("holdSlot announces the hold so live venue pages can update")
    void holdSlot_publishesHeldEvent() {
        slot.setVenueId(7L);
        slot.setSlotDate(LocalDate.of(2026, 8, 20));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        OffsetDateTime heldUntil = bookingService.holdSlot(USER_ID, SLOT_ID);

        ArgumentCaptor<SlotStatusChangedEvent> captor = ArgumentCaptor.forClass(SlotStatusChangedEvent.class);
        verify(events).publishEvent(captor.capture());
        SlotStatusChangedEvent published = captor.getValue();
        assertEquals(SLOT_ID, published.slotId());
        assertEquals(7L, published.venueId());
        assertEquals(LocalDate.of(2026, 8, 20), published.slotDate());
        assertEquals(SlotStatus.HELD, published.status());
        assertEquals(heldUntil, published.heldUntil());
    }

    @Test
    @DisplayName("a rejected hold announces nothing — a failed attempt must not blank the slot for everyone")
    void holdSlot_publishesNothing_whenRejected() {
        slot.setStatus(SlotStatus.BOOKED);
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        assertThrows(SlotUnavailableException.class, () -> bookingService.holdSlot(USER_ID, SLOT_ID));

        verify(events, never()).publishEvent(any(SlotStatusChangedEvent.class));
    }

    @Test
    @DisplayName("holdSlot refreshes the caller's own still-active hold instead of failing")
    void holdSlot_refreshesOwnActiveHold() {
        OffsetDateTime originalExpiry = OffsetDateTime.now().plusMinutes(4);
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(USER_ID);
        slot.setHoldExpiresAt(originalExpiry);
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        bookingService.holdSlot(USER_ID, SLOT_ID);

        assertEquals(SlotStatus.HELD, slot.getStatus());
        assertEquals(USER_ID, slot.getHeldByUserId());
        assertTrue(slot.getHoldExpiresAt().isAfter(originalExpiry));
        verify(slotRepository).save(slot);
    }

    @Test
    @DisplayName("holdSlot succeeds when the existing hold has expired")
    void holdSlot_succeeds_whenExistingHoldExpired() {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(OTHER_USER_ID);
        slot.setHoldExpiresAt(OffsetDateTime.now().minusSeconds(10));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        bookingService.holdSlot(USER_ID, SLOT_ID);

        assertEquals(SlotStatus.HELD, slot.getStatus());
        assertEquals(USER_ID, slot.getHeldByUserId());
        assertNotNull(slot.getHoldExpiresAt());
        assertTrue(slot.getHoldExpiresAt().isAfter(OffsetDateTime.now()));
        verify(slotRepository).save(slot);
    }

    @Test
    @DisplayName("holdSlot fails on a BOOKED slot")
    void holdSlot_fails_whenBooked() {
        slot.setStatus(SlotStatus.BOOKED);
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        assertThrows(SlotUnavailableException.class, () -> bookingService.holdSlot(USER_ID, SLOT_ID));

        verify(slotRepository, never()).save(any());
    }

    @Test
    @DisplayName("confirmBooking converts the caller's active hold into a confirmed booking")
    void confirmBooking_succeeds_whenHoldOwnedAndActive() {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(USER_ID);
        slot.setHoldExpiresAt(OffsetDateTime.now().plusMinutes(3));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));
        when(bookingRepository.findByBookingCode(anyString())).thenReturn(Optional.empty());
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Booking booking = bookingService.confirmBooking(USER_ID, SLOT_ID);

        assertNotNull(booking);
        assertEquals(BookingStatus.CONFIRMED, booking.getStatus());
        assertEquals(USER_ID, booking.getUserId());
        assertEquals(slot, booking.getSlot());
        assertNotNull(booking.getBookingCode());
        assertTrue(booking.getBookingCode().startsWith("TC-"));

        assertEquals(SlotStatus.BOOKED, slot.getStatus());
        assertNull(slot.getHeldByUserId());
        assertNull(slot.getHoldExpiresAt());
        verify(slotRepository).save(slot);
    }

    @Test
    @DisplayName("confirmBooking fails when the hold has expired")
    void confirmBooking_fails_whenHoldExpired() {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(USER_ID);
        slot.setHoldExpiresAt(OffsetDateTime.now().minusSeconds(5));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        assertThrows(SlotUnavailableException.class, () -> bookingService.confirmBooking(USER_ID, SLOT_ID));

        assertEquals(SlotStatus.HELD, slot.getStatus());
        verify(slotRepository, never()).save(any());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("confirmBooking fails when the hold belongs to another user")
    void confirmBooking_fails_whenHoldOwnedByOtherUser() {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(OTHER_USER_ID);
        slot.setHoldExpiresAt(OffsetDateTime.now().plusMinutes(3));
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        assertThrows(SlotUnavailableException.class, () -> bookingService.confirmBooking(USER_ID, SLOT_ID));

        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("cancelBooking resets the booking to CANCELLED and the slot to AVAILABLE")
    void cancelBooking_resetsSlot_whenOwner() {
        slot.setStatus(SlotStatus.BOOKED);
        Booking booking = Booking.builder()
                .id(7L)
                .bookingCode("TC-ABC123")
                .slot(slot)
                .userId(USER_ID)
                .status(BookingStatus.CONFIRMED)
                .build();
        when(bookingRepository.findById(7L)).thenReturn(Optional.of(booking));
        // The slot is re-read under a row lock before it is released.
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));

        bookingService.cancelBooking(USER_ID, 7L);

        assertEquals(BookingStatus.CANCELLED, booking.getStatus());
        assertEquals(SlotStatus.AVAILABLE, slot.getStatus());
        assertNull(slot.getHeldByUserId());
        assertNull(slot.getHoldExpiresAt());
        verify(bookingRepository).save(booking);
        verify(slotRepository).save(slot);
    }

    @Test
    @DisplayName("holdSlot fails when venue is OFFLINE")
    void holdSlot_fails_whenVenueIsOffline() {
        slot.setVenueId(100L);
        com.turfchai.venue.entity.Venue offlineVenue = com.turfchai.venue.entity.Venue.builder()
                .id(100L)
                .status("OFFLINE")
                .build();
        when(slotRepository.findByIdForUpdate(SLOT_ID)).thenReturn(Optional.of(slot));
        when(venueRepository.findById(100L)).thenReturn(Optional.of(offlineVenue));

        assertThrows(SlotUnavailableException.class, () -> bookingService.holdSlot(USER_ID, SLOT_ID));
        verify(slotRepository, never()).save(any());
    }
}
