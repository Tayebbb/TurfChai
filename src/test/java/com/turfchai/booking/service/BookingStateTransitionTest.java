package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * State-transition and idempotency guards on the booking lifecycle.
 *
 * <p>The double-cancel case is the important one: cancelling releases the slot,
 * so running it twice used to hand an AVAILABLE status to a slot that a
 * different booking had taken in between — a silent double-sell.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:booking-state-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class BookingStateTransitionTest {

    @Autowired
    private BookingService bookingService;
    @Autowired
    private BookingRepository bookings;
    @Autowired
    private SlotRepository slots;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private PitchRepository pitches;

    private User playerA;
    private User playerB;
    private Long venueId;

    @BeforeEach
    void setUp() {
        playerA = TestAuth.user(users, encoder, "state.a@turfchai.test", RoleType.PLAYER);
        playerB = TestAuth.user(users, encoder, "state.b@turfchai.test", RoleType.PLAYER);

        Venue venue = venues.save(Venue.builder()
                .slug("state-venue-" + System.nanoTime())
                .name("State Venue")
                .address("Addr")
                .area("Dhanmondi")
                .build());
        venueId = venue.getId();

        Pitch pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch 1");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitches.save(pitch);
    }

    private Slot futureSlot() {
        return slots.save(Slot.builder()
                .pitch(pitches.findByVenueId(venueId).get(0))
                .venueId(venueId)
                .slotDate(LocalDate.now().plusDays(5))
                .startTime(LocalTime.of(19, 0))
                .endTime(LocalTime.of(20, 30))
                .price(BigDecimal.valueOf(2500))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    @Test
    @DisplayName("Cancelling twice is rejected instead of releasing the slot again")
    void doubleCancelIsRejected() {
        Slot slot = futureSlot();
        bookingService.holdSlot(playerA.getId(), slot.getId());
        Booking booking = bookingService.confirmBooking(playerA.getId(), slot.getId());

        bookingService.cancelBooking(playerA.getId(), booking.getId());

        assertThrows(IllegalStateException.class,
                () -> bookingService.cancelBooking(playerA.getId(), booking.getId()));
    }

    @Test
    @DisplayName("Re-cancelling an old booking cannot free a slot another booking now holds")
    void staleCancelDoesNotStealAnotherBookingsSlot() {
        Slot slot = futureSlot();

        // A books, then cancels — the slot goes back to AVAILABLE.
        bookingService.holdSlot(playerA.getId(), slot.getId());
        Booking first = bookingService.confirmBooking(playerA.getId(), slot.getId());
        bookingService.cancelBooking(playerA.getId(), first.getId());
        assertEquals(SlotStatus.AVAILABLE, slots.findById(slot.getId()).orElseThrow().getStatus());

        // B takes the freed slot.
        bookingService.holdSlot(playerB.getId(), slot.getId());
        Booking second = bookingService.confirmBooking(playerB.getId(), slot.getId());
        assertEquals(SlotStatus.BOOKED, slots.findById(slot.getId()).orElseThrow().getStatus());

        // A's stale cancel must not touch the slot B now owns.
        assertThrows(IllegalStateException.class,
                () -> bookingService.cancelBooking(playerA.getId(), first.getId()));
        assertEquals(SlotStatus.BOOKED, slots.findById(slot.getId()).orElseThrow().getStatus());
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(second.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("A cancelled booking cannot be resurrected by approving it")
    void approveRejectsACancelledBooking() {
        Slot slot = futureSlot();
        bookingService.holdSlot(playerA.getId(), slot.getId());
        Booking booking = bookingService.confirmBooking(playerA.getId(), slot.getId());
        bookingService.cancelBooking(playerA.getId(), booking.getId());

        assertThrows(IllegalStateException.class,
                () -> bookingService.approveBooking(playerA.getId(), booking.getId()));
        assertEquals(BookingStatus.CANCELLED, bookings.findById(booking.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Approving an already-confirmed booking is rejected")
    void approveRejectsAConfirmedBooking() {
        Slot slot = futureSlot();
        bookingService.holdSlot(playerA.getId(), slot.getId());
        Booking booking = bookingService.confirmBooking(playerA.getId(), slot.getId());

        assertThrows(IllegalStateException.class,
                () -> bookingService.approveBooking(playerA.getId(), booking.getId()));
    }

    @Test
    @DisplayName("A pending payment booking is reused rather than duplicated on retry")
    void pendingBookingIsIdempotentPerUserAndSlot() {
        Slot slot = futureSlot();
        bookingService.holdSlot(playerA.getId(), slot.getId());

        Booking first = bookingService.createPendingBooking(playerA.getId(), slot.getId());
        Booking retry = bookingService.createPendingBooking(playerA.getId(), slot.getId());

        assertEquals(first.getId(), retry.getId());
        assertEquals(1, bookings.findBySlotIdAndStatusNot(slot.getId(), BookingStatus.CANCELLED).size());
    }

    @Test
    @DisplayName("A second user cannot confirm a slot the first user holds")
    void confirmRequiresOwnershipOfTheHold() {
        Slot slot = futureSlot();
        bookingService.holdSlot(playerA.getId(), slot.getId());

        assertThrows(com.turfchai.booking.exception.SlotUnavailableException.class,
                () -> bookingService.confirmBooking(playerB.getId(), slot.getId()));
    }
}
