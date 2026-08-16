package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.exception.BookingNotFoundException;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.service.PaymentService;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * Who is allowed to touch a booking, and on what terms.
 *
 * <p>
 * Two rules are load-bearing for trust: an owner may only act on bookings at
 * their own venue, and the cancellation terms a player agreed to at checkout
 * are
 * the terms they get refunded under.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:booking-access-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class BookingAccessControlIntegrationTest {

        @Autowired
        private BookingService bookingService;
        @Autowired
        private PaymentService paymentService;
        @Autowired
        private SlotRepository slots;
        @Autowired
        private BookingRepository bookings;
        @Autowired
        private VenueRepository venues;
        @Autowired
        private PitchRepository pitches;
        @Autowired
        private UserRepository users;
        @Autowired
        private PasswordEncoder encoder;

        private User player;
        private User ownerA;
        private User ownerB;
        private Venue venueA;

        @BeforeEach
        void setUp() {
                long n = System.nanoTime();
                player = TestAuth.user(users, encoder, "acl.player." + n + "@turfchai.test", RoleType.PLAYER);
                ownerA = TestAuth.user(users, encoder, "acl.owner.a." + n + "@turfchai.test", RoleType.OWNER);
                ownerB = TestAuth.user(users, encoder, "acl.owner.b." + n + "@turfchai.test", RoleType.OWNER);

                venueA = venues.save(Venue.builder()
                                .slug("acl-venue-a-" + n)
                                .name("Venue A")
                                .address("A")
                                .area("Dhanmondi")
                                .owner(ownerA)
                                .cancelPolicy("FREE_24H_50_6H")
                                .build());
                Pitch pitch = new Pitch();
                pitch.setVenue(venueA);
                pitch.setName("Pitch A");
                pitch.setMaxPlayers(10);
                pitch.setActive(true);
                pitches.save(pitch);
        }

        private Slot freshSlot() {
                return slots.save(Slot.builder()
                                .pitch(pitches.findByVenueId(venueA.getId()).get(0))
                                .venueId(venueA.getId())
                                .slotDate(LocalDate.now().plusDays(10))
                                .startTime(LocalTime.of(20, 0))
                                .endTime(LocalTime.of(21, 30))
                                .price(new BigDecimal("1200.00"))
                                .status(SlotStatus.AVAILABLE)
                                .build());
        }

        private Long confirmedBooking() {
                Slot slot = freshSlot();
                bookingService.holdSlot(player.getId(), slot.getId());
                return paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null).getBookingId();
        }

        @Test
        @DisplayName("An owner cannot read a booking at another owner's venue")
        void otherOwnerCannotReadBooking() {
                Long bookingId = confirmedBooking();

                assertThat(bookingService.getBooking(ownerA.getId(), bookingId)).isNotNull();
                assertThatThrownBy(() -> bookingService.getBooking(ownerB.getId(), bookingId))
                                .as("owner B has no venue in this booking")
                                .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("An owner cannot cancel or refund a booking at another owner's venue")
        void otherOwnerCannotRefundBooking() {
                Long bookingId = confirmedBooking();

                assertThatThrownBy(() -> paymentService.cancelAndRefund(ownerB.getId(), bookingId))
                                .isInstanceOf(RuntimeException.class);

                assertThat(bookings.findById(bookingId).orElseThrow().getStatus())
                                .as("the booking must survive another owner's attempt to cancel it")
                                .isEqualTo(BookingStatus.CONFIRMED);
        }

        @Test
        @DisplayName("A player cannot cancel someone else's booking")
        void otherPlayerCannotCancelBooking() {
                Long bookingId = confirmedBooking();
                User stranger = TestAuth.user(users, encoder,
                                "acl.stranger." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);

                assertThatThrownBy(() -> bookingService.cancelBooking(stranger.getId(), bookingId))
                                .isInstanceOf(AccessDeniedException.class);
                assertThat(bookings.findById(bookingId).orElseThrow().getStatus())
                                .isEqualTo(BookingStatus.CONFIRMED);
        }

        @Test
        @DisplayName("The venue's own owner can cancel a booking at their venue")
        void owningOwnerCanCancel() {
                Long bookingId = confirmedBooking();

                paymentService.cancelAndRefund(ownerA.getId(), bookingId);

                assertThat(bookings.findById(bookingId).orElseThrow().getStatus())
                                .isEqualTo(BookingStatus.CANCELLED);
        }

        @Test
        @DisplayName("Refunds honour the policy captured at checkout, not the venue's later terms")
        void cancellationTermsAreSnapshotAtConfirmation() {
                Long bookingId = confirmedBooking();

                Booking booking = bookings.findById(bookingId).orElseThrow();
                assertThat(booking.getCancelPolicySnapshot())
                                .as("the agreed terms must be recorded on the booking")
                                .isEqualTo("FREE_24H_50_6H");

                // The owner tightens their terms after the player has already paid.
                Venue venue = venues.findById(venueA.getId()).orElseThrow();
                venue.setCancelPolicy("STRICT_NO_REFUND");
                venues.save(venue);

                var preview = paymentService.previewRefund(player.getId(), bookingId);
                assertThat(preview.getCancelPolicy()).isEqualTo("FREE_24H_50_6H");
                assertThat(preview.getRefundPercent())
                                .as("a player cannot be moved onto worse terms after paying")
                                .isEqualTo(100);
        }

        /**
         * A booking that is not yours and a booking that does not exist must be
         * reported identically, or the difference between the two answers turns the
         * id space into a directory of other people's bookings. Both were previously
         * SlotUnavailableException, which answers 409 Conflict - the correct status
         * for a slot already taken, but wrong for a booking that is not there.
         */
        @Test
        @DisplayName("A foreign booking is indistinguishable from a missing one, and both are 404")
        void foreignAndMissingBookingsAreIndistinguishable() {
                Long bookingId = confirmedBooking();
                User stranger = TestAuth.user(users, encoder,
                                "acl.stranger." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);

                Throwable foreign = catchThrowable(() -> bookingService.getBooking(stranger.getId(), bookingId));
                Throwable missing = catchThrowable(() -> bookingService.getBooking(stranger.getId(), 99_999_999L));

                assertThat(foreign).isInstanceOf(BookingNotFoundException.class);
                assertThat(missing).isInstanceOf(BookingNotFoundException.class);
                // Each message only ever echoes the id the caller already supplied, so
                // once the id is normalised the two answers are byte-identical and give
                // an attacker no way to tell "not yours" from "does not exist".
                assertThat(foreign.getMessage().replaceAll("\\d+", "#"))
                                .as("the two answers must not let an attacker tell the cases apart")
                                .isEqualTo(missing.getMessage().replaceAll("\\d+", "#"));
                assertThat(foreign.getMessage())
                                .as("no detail about the real booking may leak")
                                .doesNotContain(player.getEmail())
                                .doesNotContain(venueA.getName());
        }
}
