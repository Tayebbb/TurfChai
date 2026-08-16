package com.turfchai.notification;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.booking.service.BookingReminderJob;
import com.turfchai.booking.service.BookingService;
import com.turfchai.model.Notification;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.service.PaymentService;
import com.turfchai.repository.NotificationRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.NotificationService;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A player's notification feed has to be a record of things that actually
 * happened to them.
 *
 * <p>
 * Every notification here is written by the service that performs the state
 * transition, inside the transaction that performs it — so a feed entry cannot
 * exist for a booking that was never confirmed, and a confirmed booking cannot
 * exist without one.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:player-notifications;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlayerNotificationLifecycleTest {

    @Autowired
    BookingService bookingService;
    @Autowired
    PaymentService paymentService;
    @Autowired
    NotificationService notificationService;
    @Autowired
    BookingReminderJob reminderJob;
    @Autowired
    NotificationRepository notifications;
    @Autowired
    SlotRepository slots;
    @Autowired
    VenueRepository venues;
    @Autowired
    PitchRepository pitches;
    @Autowired
    UserRepository users;
    @Autowired
    PasswordEncoder encoder;

    private User player;
    private User owner;
    private Venue venue;

    @BeforeEach
    void setUp() {
        player = TestAuth.user(users, encoder,
                "notify.player." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
        owner = TestAuth.user(users, encoder,
                "notify.owner." + System.nanoTime() + "@turfchai.test", RoleType.OWNER);
        venue = venues.save(Venue.builder()
                .slug("notify-arena-" + System.nanoTime())
                .name("Notify Arena")
                .address("1 Notify Road")
                .area("Dhanmondi")
                .owner(owner)
                // Far-future slots sit in the 100% refund tier.
                .cancelPolicy("FREE_24H_50_6H")
                .build());
        Pitch pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch 1");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitches.save(pitch);
    }

    private Slot freshSlot() {
        return slots.save(Slot.builder()
                .pitch(pitches.findByVenueId(venue.getId()).get(0))
                .venueId(venue.getId())
                .slotDate(LocalDate.now().plusDays(10))
                .startTime(LocalTime.of(18, 0))
                .endTime(LocalTime.of(19, 30))
                .price(BigDecimal.valueOf(2000))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    /** Books and pays for a fresh slot the way the checkout does. */
    private Long book(User who) {
        Slot slot = freshSlot();
        bookingService.holdSlot(who.getId(), slot.getId());
        return paymentService.pay(who.getId(), slot.getId(), PaymentMethod.BKASH, BigDecimal.ZERO)
                .getBookingId();
    }

    private List<Notification> feed(User who) {
        return notificationService.listForUser(who.getId());
    }

    private List<Notification> feedOf(User who, String type) {
        return feed(who).stream().filter(n -> type.equals(n.getType())).toList();
    }

    // ── the events ─────────────────────────────────────────────────────────

    @Test
    void confirmingABookingNotifiesThePlayerWhoMadeIt() {
        Long bookingId = book(player);

        List<Notification> confirmations = feedOf(player, "BOOKING_CONFIRMED");

        assertThat(confirmations).hasSize(1);
        Notification notification = confirmations.get(0);
        assertThat(notification.getIsRead()).isFalse();
        assertThat(notification.getTitle()).contains("Notify Arena");
        assertThat(notification.getLink()).isEqualTo("/player/bookings/" + bookingId);
        assertThat(notificationService.getUnreadCount(player.getId())).isEqualTo(confirmations.size());
    }

    @Test
    void cancellingNotifiesThePlayerAndSaysWhenTheVenueDidIt() {
        Long bookingId = book(player);

        // The owner cancels, not the player — the case the player must be told about.
        bookingService.cancelBooking(owner.getId(), bookingId);

        List<Notification> cancellations = feedOf(player, "BOOKING_CANCELLED");
        assertThat(cancellations).hasSize(1);
        assertThat(cancellations.get(0).getBody()).containsIgnoringCase("cancelled by the venue");
        assertThat(cancellations.get(0).getLink()).isEqualTo("/player/bookings/" + bookingId);
        // and the owner is not told about the player's booking
        assertThat(feedOf(owner, "BOOKING_CANCELLED")).isEmpty();
    }

    @Test
    void aPlayerCancellingTheirOwnBookingIsNotToldTheVenueDidIt() {
        Long bookingId = book(player);

        bookingService.cancelBooking(player.getId(), bookingId);

        assertThat(feedOf(player, "BOOKING_CANCELLED").get(0).getBody())
                .doesNotContainIgnoringCase("by the venue");
    }

    @Test
    void aRefundNotifiesThePlayerWithWhatWasActuallyReturned() {
        Long bookingId = book(player);

        var refund = paymentService.cancelAndRefund(player.getId(), bookingId);

        assertThat(refund.getRefundAmount()).isEqualByComparingTo("2000");
        List<Notification> refunds = feedOf(player, "REFUND_ISSUED");
        assertThat(refunds).hasSize(1);
        assertThat(refunds.get(0).getTitle()).contains("2000");
        assertThat(refunds.get(0).getBody()).contains("100%");
    }

    @Test
    void aCheckoutThatLosesItsSlotTellsThePlayerNothingWasCharged() {
        Slot slot = freshSlot();
        bookingService.holdSlot(player.getId(), slot.getId());

        // The hold lapses while the player is on the payment screen.
        Slot held = slots.findById(slot.getId()).orElseThrow();
        held.setHoldExpiresAt(OffsetDateTime.now().minusMinutes(1));
        slots.save(held);

        assertThatThrownBy(() -> paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, BigDecimal.ZERO))
                .isInstanceOf(SlotUnavailableException.class);

        // The checkout rolled back, but the record of the failure survived it.
        List<Notification> failures = feedOf(player, "PAYMENT_FAILED");
        assertThat(failures).hasSize(1);
        assertThat(failures.get(0).getBody()).containsIgnoringCase("nothing was charged");
    }

    @Test
    void aBookingStartingSoonIsRemindedAboutOnceAndOnlyOnce() {
        Slot soon = slots.save(Slot.builder()
                .pitch(pitches.findByVenueId(venue.getId()).get(0))
                .venueId(venue.getId())
                .slotDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .price(BigDecimal.valueOf(1500))
                .status(SlotStatus.AVAILABLE)
                .build());
        bookingService.holdSlot(player.getId(), soon.getId());
        paymentService.pay(player.getId(), soon.getId(), PaymentMethod.BKASH, BigDecimal.ZERO);

        LocalDateTime now = LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(0, 30));

        reminderJob.sendRemindersAsOf(now);
        assertThat(feedOf(player, "BOOKING_REMINDER")).hasSize(1);

        // Sweeping the same window again must not remind them a second time.
        reminderJob.sendRemindersAsOf(now);
        assertThat(feedOf(player, "BOOKING_REMINDER")).hasSize(1);
        assertThat(feedOf(player, "BOOKING_REMINDER").get(0).getBody()).contains("9:00 AM");
    }

    @Test
    void aBookingTooFarOutIsNotRemindedAboutYet() {
        book(player); // 10 days away

        reminderJob.sendRemindersAsOf(LocalDateTime.now());

        assertThat(feedOf(player, "BOOKING_REMINDER")).isEmpty();
    }

    // ── the guarantees around the feed ─────────────────────────────────────

    @Test
    void repeatingTheSameEventDoesNotStackTheFeed() {
        Long bookingId = book(player);
        String link = "/player/bookings/" + bookingId;

        assertThat(notificationService.sendOnce(player.getId(), "BOOKING_CONFIRMED", "again", "again", link))
                .isFalse();

        assertThat(feedOf(player, "BOOKING_CONFIRMED")).hasSize(1);
    }

    @Test
    void aPlayerCannotMarkAnotherPlayersNotificationRead() {
        book(player);
        Notification theirs = feedOf(player, "BOOKING_CONFIRMED").get(0);

        assertThatThrownBy(() -> notificationService.markRead(theirs.getId(), owner.getId()))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(notifications.findById(theirs.getId()).orElseThrow().getIsRead()).isFalse();
        assertThat(notificationService.getUnreadCount(player.getId())).isEqualTo(1);
    }

    @Test
    void eachPlayerOnlySeesTheirOwnEvents() {
        User other = TestAuth.user(users, encoder,
                "notify.other." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
        Long mine = book(player);
        Long theirs = book(other);

        assertThat(feed(player)).allSatisfy(n -> assertThat(n.getUserId()).isEqualTo(player.getId()));
        assertThat(feed(other)).allSatisfy(n -> assertThat(n.getUserId()).isEqualTo(other.getId()));
        assertThat(feed(player)).anySatisfy(n -> assertThat(n.getLink()).isEqualTo("/player/bookings/" + mine));
        assertThat(feed(player)).noneSatisfy(n -> assertThat(n.getLink()).isEqualTo("/player/bookings/" + theirs));
    }

    @Test
    void aPlayerWhoHasDoneNothingHasAnEmptyFeedAndNoUnreadCount() {
        User newcomer = TestAuth.user(users, encoder,
                "notify.newcomer." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);

        assertThat(feed(newcomer)).isEmpty();
        assertThat(notificationService.getUnreadCount(newcomer.getId())).isZero();
    }

    @Test
    void readingANotificationClearsItFromTheUnreadCountAndStaysCleared() {
        book(player);
        Notification confirmation = feedOf(player, "BOOKING_CONFIRMED").get(0);
        assertThat(notificationService.getUnreadCount(player.getId())).isEqualTo(1);

        notificationService.markRead(confirmation.getId(), player.getId());

        assertThat(notificationService.getUnreadCount(player.getId())).isZero();
        // Re-read from the database: the state is persisted, not in-memory.
        assertThat(feedOf(player, "BOOKING_CONFIRMED").get(0).getIsRead()).isTrue();
    }

    @Test
    void markingAllReadOnlyTouchesTheCallersOwnFeed() {
        book(player);
        User other = TestAuth.user(users, encoder,
                "notify.bystander." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
        book(other);

        notificationService.markAllRead(player.getId());

        assertThat(notificationService.getUnreadCount(player.getId())).isZero();
        assertThat(notificationService.getUnreadCount(other.getId())).isEqualTo(1);
    }

    @Test
    void aBookingAndItsNotificationAgreeOnWhatHappened() {
        Long bookingId = book(player);
        Booking booking = bookingService.getBooking(player.getId(), bookingId);

        Notification confirmation = feedOf(player, "BOOKING_CONFIRMED").get(0);

        assertThat(confirmation.getBody()).contains(booking.getBookingCode());
        assertThat(confirmation.getCreatedAt()).isNotNull();
    }
}
