package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.booking.service.BookingService;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.payment.entity.Payment;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.reward.service.RewardService;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * End-to-end money invariants over the real database.
 *
 * <p>
 * The rule these all serve: <b>what is refunded must equal what was taken, by
 * tender.</b> Previously the refund was computed from the booking price, so a
 * booking part-funded by wallet credit paid out more cash than the gateway had
 * ever received, and the wallet was never given back.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:money-lifecycle-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class PaymentLifecycleIntegrationTest {

        @Autowired
        private PaymentService paymentService;
        @Autowired
        private BookingService bookingService;
        @Autowired
        private RewardService rewardService;
        @Autowired
        private PaymentRepository payments;
        @Autowired
        private BookingRepository bookings;
        @Autowired
        private SlotRepository slots;
        @Autowired
        private VenueRepository venues;
        @Autowired
        private PitchRepository pitches;
        @Autowired
        private UserRepository users;
        @Autowired
        private PasswordEncoder encoder;

        private User player;
        private Venue venue;

        @BeforeEach
        void setUp() {
                player = TestAuth.user(users, encoder,
                                "money.player." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
                venue = venues.save(Venue.builder()
                                .slug("money-venue-" + System.nanoTime())
                                .name("Money Venue")
                                .address("Addr")
                                .area("Dhanmondi")
                                // Far-future slots are always in the 100% tier.
                                .cancelPolicy("FREE_24H_50_6H")
                                .build());
                Pitch pitch = new Pitch();
                pitch.setVenue(venue);
                pitch.setName("Pitch 1");
                pitch.setMaxPlayers(10);
                pitch.setActive(true);
                pitches.save(pitch);
        }

        private Slot freshSlot(BigDecimal price) {
                return slots.save(Slot.builder()
                                .pitch(pitches.findByVenueId(venue.getId()).get(0))
                                .venueId(venue.getId())
                                .slotDate(LocalDate.now().plusDays(10))
                                .startTime(LocalTime.of(18, 0))
                                .endTime(LocalTime.of(19, 30))
                                .price(price)
                                .status(SlotStatus.AVAILABLE)
                                .build());
        }

        private List<Payment> paymentsFor(Long bookingId) {
                return payments.findByBookingIdOrderByCreatedAtDesc(bookingId);
        }

        /**
         * Every payment ever recorded against a slot, however the booking got there.
         */
        private List<Payment> paymentsForSlot(Long slotId) {
                return bookings.findAll().stream()
                                .filter(b -> b.getSlot() != null && slotId.equals(b.getSlot().getId()))
                                .flatMap(b -> paymentsFor(b.getId()).stream())
                                .toList();
        }

        // ── The core invariant ──────────────────────────────────────────────────

        @Test
        @DisplayName("A wallet-funded booking refunds the gateway and the wallet separately, never double")
        void refundSplitsByTender() {
                rewardService.refundToWallet(player.getId(), new BigDecimal("500.00"), null);
                Slot slot = freshSlot(new BigDecimal("2000.00"));

                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH,
                                new BigDecimal("500.00"));

                assertThat(checkout.getWalletApplied()).isEqualByComparingTo("500.00");
                assertThat(checkout.getPayment().getAmount()).isEqualByComparingTo("1500.00");
                assertThat(rewardService.getWalletBalance(player.getId())).isEqualByComparingTo("0.00");

                var refund = paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                // 100% of what was actually taken: ৳1500 cash + ৳500 credit.
                assertThat(refund.getRefundPercent()).isEqualTo(100);
                assertThat(refund.getRefundAmount()).isEqualByComparingTo("2000.00");

                BigDecimal cashRefunded = paymentsFor(checkout.getBookingId()).stream()
                                .filter(p -> p.getType() == PaymentType.REFUND
                                                && !Boolean.TRUE.equals(p.getIsRewardWalletPayment()))
                                .map(Payment::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                assertThat(cashRefunded)
                                .as("the gateway may only be refunded what the gateway received")
                                .isEqualByComparingTo("1500.00");
                assertThat(rewardService.getWalletBalance(player.getId()))
                                .as("the wallet portion goes back to the wallet")
                                .isEqualByComparingTo("500.00");
        }

        @Test
        @DisplayName("A booking paid entirely from the wallet still records a payment row")
        void walletOnlyBookingIsStillLedgered() {
                rewardService.refundToWallet(player.getId(), new BigDecimal("2000.00"), null);
                Slot slot = freshSlot(new BigDecimal("2000.00"));

                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH,
                                new BigDecimal("2000.00"));

                Booking booking = bookings.findById(checkout.getBookingId()).orElseThrow();
                assertThat(booking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
                assertThat(paymentsFor(booking.getId()))
                                .as("a confirmed booking must never have an empty payment ledger")
                                .isNotEmpty();
                assertThat(paymentsFor(booking.getId()).get(0).getIsRewardWalletPayment()).isTrue();
        }

        @Test
        @DisplayName("A never-paid booking refunds nothing")
        void pendingBookingRefundsNothing() {
                Slot slot = freshSlot(new BigDecimal("2000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                Booking pending = bookingService.createPendingBooking(player.getId(), slot.getId());

                var refund = paymentService.cancelAndRefund(player.getId(), pending.getId());

                assertThat(refund.getRefundAmount())
                                .as("money that was never taken cannot be given back")
                                .isEqualByComparingTo("0.00");
                assertThat(paymentsFor(pending.getId())).isEmpty();
                assertThat(bookings.findById(pending.getId()).orElseThrow().getStatus())
                                .isEqualTo(BookingStatus.CANCELLED);
        }

        @Test
        @DisplayName("A refunded charge is marked REFUNDED, not left looking like a completed sale")
        void originalPaymentIsMarkedRefunded() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.NAGAD, null);

                paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                assertThat(paymentsFor(checkout.getBookingId()))
                                .filteredOn(p -> p.getType() == PaymentType.BOOKING)
                                .allMatch(p -> p.getStatus() == PaymentStatus.REFUNDED);
        }

        @Test
        @DisplayName("A split payment's refund is ledgered per tender and reconciles to the total")
        void refundLedgerReconcilesPerTender() {
                rewardService.refundToWallet(player.getId(), new BigDecimal("500.00"), null);
                Slot slot = freshSlot(new BigDecimal("2000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH,
                                new BigDecimal("500.00"));

                var refund = paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                List<Payment> ledger = paymentsFor(checkout.getBookingId());
                BigDecimal refundedInLedger = ledger.stream()
                                .filter(p -> p.getType() == PaymentType.REFUND)
                                .map(Payment::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                assertThat(refundedInLedger)
                                .as("the ledger must account for every taka refunded, not just the cash leg")
                                .isEqualByComparingTo(refund.getRefundAmount());

                // The gateway charge itself is the row that gets reversed, never the wallet
                // leg.
                Payment gatewayCharge = ledger.stream()
                                .filter(p -> p.getType() == PaymentType.BOOKING
                                                && !Boolean.TRUE.equals(p.getIsRewardWalletPayment()))
                                .findFirst()
                                .orElseThrow();
                assertThat(gatewayCharge.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
                assertThat(gatewayCharge.getAmount()).isEqualByComparingTo("1500.00");
        }

        @Test
        @DisplayName("Cancelling twice cannot refund twice")
        void doubleRefundIsRejected() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.CARD, null);

                paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                assertThatThrownBy(() -> paymentService.cancelAndRefund(player.getId(), checkout.getBookingId()))
                                .isInstanceOf(IllegalStateException.class);

                assertThat(paymentsFor(checkout.getBookingId()))
                                .filteredOn(p -> p.getType() == PaymentType.REFUND)
                                .hasSize(1);
        }

        @Test
        @DisplayName("Points earned on a booking are removed when it is cancelled")
        void pointsAreClawedBack() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null);

                int afterBooking = rewardService.getMyPoints(player.getId()).getBalance();
                assertThat(afterBooking).isGreaterThan(0);

                paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                assertThat(rewardService.getMyPoints(player.getId()).getBalance())
                                .as("booking then cancelling at a full refund must not leave free points behind")
                                .isEqualTo(afterBooking - checkout.getPointsEarned());
        }

        // ── Slot state and double-selling ───────────────────────────────────────

        @Test
        @DisplayName("Paying for a slot somebody else holds is refused")
        void cannotPayForAnotherUsersHold() {
                User other = TestAuth.user(users, encoder,
                                "money.other." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(other.getId(), slot.getId());

                assertThatThrownBy(() -> paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null))
                                .isInstanceOf(SlotUnavailableException.class);
                assertThat(paymentsForSlot(slot.getId()))
                                .as("no money may be taken for a slot the payer does not hold")
                                .isEmpty();
        }

        @Test
        @DisplayName("Paying twice for the same slot is refused and charges once")
        void duplicatePaymentIsRefused() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var first = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null);

                assertThatThrownBy(() -> paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null))
                                .isInstanceOf(SlotUnavailableException.class);

                assertThat(paymentsFor(first.getBookingId()))
                                .filteredOn(p -> p.getType() == PaymentType.BOOKING)
                                .hasSize(1);
        }

        @Test
        @DisplayName("A slot that has already started cannot be paid for")
        void pastSlotCannotBePaid() {
                Slot past = slots.save(Slot.builder()
                                .pitch(pitches.findByVenueId(venue.getId()).get(0))
                                .venueId(venue.getId())
                                .slotDate(LocalDate.now().minusDays(1))
                                .startTime(LocalTime.of(18, 0))
                                .endTime(LocalTime.of(19, 30))
                                .price(new BigDecimal("1000.00"))
                                .status(SlotStatus.AVAILABLE)
                                .build());

                assertThatThrownBy(() -> bookingService.holdSlot(player.getId(), past.getId()))
                                .isInstanceOf(SlotUnavailableException.class);
                assertThatThrownBy(() -> paymentService.pay(player.getId(), past.getId(), PaymentMethod.BKASH, null))
                                .isInstanceOf(SlotUnavailableException.class);
                assertThat(paymentsForSlot(past.getId()))
                                .as("a slot in the past must never take money")
                                .isEmpty();
        }

        @Test
        @DisplayName("A blocked slot cannot be held or paid for")
        void blockedSlotCannotBeBooked() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                slot.setStatus(SlotStatus.BLOCKED);
                slots.save(slot);

                assertThatThrownBy(() -> bookingService.holdSlot(player.getId(), slot.getId()))
                                .isInstanceOf(SlotUnavailableException.class);
                assertThat(paymentsForSlot(slot.getId())).isEmpty();
        }

        @Test
        @DisplayName("An unknown slot id cannot produce a booking or a payment")
        void invalidSlotIsRejected() {
                long bookingsBefore = bookings.count();
                long paymentsBefore = payments.count();

                assertThatThrownBy(() -> paymentService.pay(player.getId(), 9_999_999L, PaymentMethod.BKASH, null))
                                .isInstanceOf(SlotUnavailableException.class);

                assertThat(bookings.count()).isEqualTo(bookingsBefore);
                assertThat(payments.count()).isEqualTo(paymentsBefore);
        }

        @Test
        @DisplayName("Payment after the hold expired is refused and takes no money")
        void paymentAfterHoldExpiryIsRefused() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                Booking pending = bookingService.createPendingBooking(player.getId(), slot.getId());

                // The hold lapses while the player is on the payment screen.
                Slot held = slots.findById(slot.getId()).orElseThrow();
                held.setHoldExpiresAt(java.time.OffsetDateTime.now().minusMinutes(1));
                slots.save(held);

                assertThatThrownBy(() -> bookingService.finalizeConfirmedBooking(pending))
                                .isInstanceOf(SlotUnavailableException.class);
                assertThat(bookings.findById(pending.getId()).orElseThrow().getStatus())
                                .isEqualTo(BookingStatus.PENDING);
        }

        @Test
        @DisplayName("Cancelling releases the slot so it can be sold again")
        void cancellingReleasesTheSlot() {
                Slot slot = freshSlot(new BigDecimal("1000.00"));
                bookingService.holdSlot(player.getId(), slot.getId());
                var checkout = paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, null);
                assertThat(slots.findById(slot.getId()).orElseThrow().getStatus()).isEqualTo(SlotStatus.BOOKED);

                paymentService.cancelAndRefund(player.getId(), checkout.getBookingId());

                assertThat(slots.findById(slot.getId()).orElseThrow().getStatus()).isEqualTo(SlotStatus.AVAILABLE);
                // And a different player can now take it.
                User next = TestAuth.user(users, encoder,
                                "money.next." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
                bookingService.holdSlot(next.getId(), slot.getId());
                var second = paymentService.pay(next.getId(), slot.getId(), PaymentMethod.BKASH, null);
                assertThat(second.getBookingId()).isNotEqualTo(checkout.getBookingId());
        }

        // ── Ledger consistency ──────────────────────────────────────────────────

        @Test
        @DisplayName("Every confirmed booking has payments summing to its price")
        void ledgerMatchesEveryConfirmedBooking() {
                rewardService.refundToWallet(player.getId(), new BigDecimal("250.00"), null);
                Slot a = freshSlot(new BigDecimal("2000.00"));
                bookingService.holdSlot(player.getId(), a.getId());
                paymentService.pay(player.getId(), a.getId(), PaymentMethod.BKASH, new BigDecimal("250.00"));

                // Scoped to this venue: the shared dev dataset also contains imported
                // historical bookings that predate the payment ledger entirely.
                List<Booking> mine = bookings.findAll().stream()
                                .filter(b -> venue.getId().equals(b.getVenueId()))
                                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                                .toList();
                assertThat(mine).isNotEmpty();

                for (Booking booking : mine) {
                        BigDecimal paid = paymentsFor(booking.getId()).stream()
                                        .filter(p -> p.getType() == PaymentType.BOOKING)
                                        .map(Payment::getAmount)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                        assertThat(paid)
                                        .as("booking %s claims to be confirmed", booking.getBookingCode())
                                        .isEqualByComparingTo(booking.getNetAmount());
                }
        }
}
