package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Concurrency guarantees of the booking engine against a real Spring context
 * and a real database (H2, no mocks). The pessimistic row lock in
 * {@link SlotRepository#findByIdForUpdate} must ensure that only one of many
 * simultaneous callers can win a given slot.
 */
@SpringBootTest
@ActiveProfiles("test")
class BookingConcurrencyIntegrationTest {

    private static final int THREAD_COUNT = 16;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private SlotRepository slotRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private VenueRepository venueRepository;

    @Autowired
    private PitchRepository pitchRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.turfchai.payment.service.PaymentService paymentService;

    @Autowired
    private com.turfchai.payment.repository.PaymentRepository paymentRepository;

    @Autowired
    private com.turfchai.reward.service.RewardService rewardService;

    @Test
    @DisplayName("only one of 16 concurrent hold-slot calls wins a single AVAILABLE slot")
    void holdSlot_allowsExactlyOneConcurrentWinner() throws Exception {
        Slot slot = freshAvailableSlot();

        Result result = runConcurrently(THREAD_COUNT, (user) -> bookingService.holdSlot(user.getId(), slot.getId()));

        assertTrue(result.failures.isEmpty(), "Unexpected failures: " + result.failures);
        assertEquals(1, result.successes.get(), "exactly one caller should win the hold");
        assertEquals(THREAD_COUNT - 1, result.slotUnavailable.get(),
                "every other caller should be rejected as slot unavailable");

        Slot reloaded = slotRepository.findById(slot.getId()).orElseThrow();
        assertEquals(SlotStatus.HELD, reloaded.getStatus());
        assertNotNull(reloaded.getHeldByUserId(), "the winning caller should be recorded as holder");
        assertNotNull(reloaded.getHoldExpiresAt(), "the hold should carry an expiry");
    }

    @Test
    @DisplayName("only one of 16 concurrent confirms produces a booking for a single held slot")
    void confirmBooking_allowsExactlyOneConcurrentWinner() throws Exception {
        Slot slot = freshAvailableSlot();
        User holder = users(1).get(0);
        bookingService.holdSlot(holder.getId(), slot.getId());

        Result result = runConcurrently(THREAD_COUNT,
                (user) -> bookingService.confirmBooking(holder.getId(), slot.getId()));

        assertTrue(result.failures.isEmpty(), "Unexpected failures: " + result.failures);
        assertEquals(1, result.successes.get(), "exactly one caller should confirm the booking");
        assertEquals(THREAD_COUNT - 1, result.slotUnavailable.get(),
                "every other caller should fail once the slot is BOOKED");

        long bookingCountForSlot = bookingRepository.findAll().stream()
                .filter(b -> b.getSlot() != null && slot.getId().equals(b.getSlot().getId()))
                .count();
        assertEquals(1, bookingCountForSlot, "exactly one booking row should exist for this slot");
    }

    @Test
    @DisplayName("16 concurrent pay calls on one held slot charge exactly once")
    void pay_chargesExactlyOnce_underConcurrency() throws Exception {
        Slot slot = freshAvailableSlot();
        User holder = users(1).get(0);
        bookingService.holdSlot(holder.getId(), slot.getId());

        Result result = runConcurrently(THREAD_COUNT,
                (user) -> paymentService.pay(holder.getId(), slot.getId(), PaymentMethod.BKASH, null));

        assertEquals(1, result.successes.get(), "a slot may only be charged for once");

        List<com.turfchai.booking.entity.Booking> forSlot = bookingRepository.findAll().stream()
                .filter(b -> b.getSlot() != null && slot.getId().equals(b.getSlot().getId()))
                .filter(b -> b.getStatus() == com.turfchai.booking.entity.BookingStatus.CONFIRMED)
                .toList();
        assertEquals(1, forSlot.size(), "exactly one confirmed booking should exist for this slot");

        BigDecimal charged = paymentRepository.findByBookingIdOrderByCreatedAtDesc(forSlot.get(0).getId()).stream()
                .filter(p -> p.getType() == PaymentType.BOOKING)
                .map(com.turfchai.payment.entity.Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, charged.compareTo(slot.getPrice()),
                "the player must be charged the slot price exactly once, was " + charged);
    }

    @Test
    @DisplayName("two concurrent checkouts cannot spend the same wallet balance twice")
    void wallet_cannotBeOverdrawn_underConcurrency() throws Exception {
        User player = users(1).get(0);
        rewardService.refundToWallet(player.getId(), new BigDecimal("500.00"), null);

        // Holds both slots directly against the repository rather than through
        // bookingService.holdSlot(): that entrypoint now rejects a second
        // concurrent hold for the same player (one active hold at a time),
        // which is correct for a real client but would make this scenario
        // impossible to set up. The wallet-overdraw guard this test exercises
        // lives in the payment layer, not the hold-acquisition layer, and
        // must hold regardless of how a player ended up holding two slots.
        Slot first = holdDirectly(freshAvailableSlot(), player.getId());
        Slot second = holdDirectly(freshAvailableSlot(), player.getId());

        CountDownLatch start = new CountDownLatch(1);
        List<Thread> workers = List.of(first, second).stream().map(slot -> new Thread(() -> {
            try {
                start.await();
                paymentService.pay(player.getId(), slot.getId(), PaymentMethod.BKASH, new BigDecimal("500.00"));
            } catch (Exception ignored) {
                // One of the two is expected to lose the race for the credit.
            }
        })).toList();
        workers.forEach(Thread::start);
        start.countDown();
        for (Thread worker : workers) {
            worker.join(30_000);
        }

        assertTrue(rewardService.getWalletBalance(player.getId()).signum() >= 0,
                "a wallet may never go overdrawn, was "
                        + rewardService.getWalletBalance(player.getId()));
    }

    private Result runConcurrently(int threads, ConcurrentCall call) throws Exception {
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger slotUnavailable = new AtomicInteger();
        List<Throwable> failures = new ArrayList<>();

        List<Thread> workers = users(threads).stream().map(user -> new Thread(() -> {
            ready.countDown();
            try {
                start.await();
                call.execute(user);
                successes.incrementAndGet();
            } catch (SlotUnavailableException e) {
                slotUnavailable.incrementAndGet();
            } catch (Throwable t) {
                synchronized (failures) {
                    failures.add(t);
                }
            }
        })).toList();

        workers.forEach(worker -> worker.start());
        assertTrue(ready.await(10, TimeUnit.SECONDS), "not all threads became ready");
        start.countDown();
        for (Thread worker : workers) {
            worker.join(30_000);
        }
        assertFalse(workers.stream().anyMatch(w -> w != null && w.isAlive()), "a worker thread did not finish");

        return new Result(successes, slotUnavailable, failures);
    }

    private List<User> users(int count) {
        long seed = Math.abs(System.nanoTime()) % 80_000_000;
        List<User> users = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            users.add(userRepository.save(User.builder()
                    .fullName("Concurrency Tester " + i)
                    .email("concurrency-" + i + "-" + System.nanoTime() + "@turfchai.test")
                    .phone("+88017" + String.format("%08d", 10_000_000 + (int) seed + i))
                    .passwordHash("x")
                    .build()));
        }
        return users;
    }

    private Slot holdDirectly(Slot slot, Long userId) {
        slot.setStatus(SlotStatus.HELD);
        slot.setHeldByUserId(userId);
        slot.setHoldExpiresAt(java.time.OffsetDateTime.now().plusMinutes(5));
        return slotRepository.save(slot);
    }

    private Slot freshAvailableSlot() {
        Venue venue = venueRepository.save(Venue.builder()
                .slug("venue-" + System.nanoTime())
                .name("Concurrency Venue")
                .address("Test Address")
                .area("Test Area")
                .build());
        Pitch pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch C");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitchRepository.save(pitch);
        return slotRepository.save(Slot.builder()
                .pitch(pitch)
                .venueId(venue.getId())
                // Must stay in the future: the engine refuses started slots.
                .slotDate(LocalDate.now().plusDays(7))
                .startTime(LocalTime.of(14, 0))
                .endTime(LocalTime.of(15, 0))
                .price(BigDecimal.valueOf(2550))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    @FunctionalInterface
    private interface ConcurrentCall {
        void execute(User user);
    }

    private record Result(
            AtomicInteger successes,
            AtomicInteger slotUnavailable,
            List<Throwable> failures) {
    }
}
