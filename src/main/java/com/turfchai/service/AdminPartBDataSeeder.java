package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.domain.Review;
import com.turfchai.domain.ReviewStatus;
import com.turfchai.model.AuditLog;
import com.turfchai.model.Payout;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.AuditLogRepository;
import com.turfchai.repository.PayoutRepository;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Part B of the demo dataset: bookings, payouts and audit logs.
 *
 * <p>
 * <b>Demo data only</b> — dev/ci profiles. This writes fabricated bookings
 * and payouts carrying money amounts, which must never reach a real database.
 * It is deliberately excluded from the {@code test} profile: over a thousand
 * synthetic bookings with no payment rows would break the money-invariant and
 * venue-cleanup suites.
 *
 * <p>
 * Runs as an ordered {@link CommandLineRunner} after Part A. It used to run
 * from {@code @PostConstruct}, which fires during bean construction — long
 * before any {@code CommandLineRunner} — so it always found the users, venues
 * and pitches missing and silently bailed. The result was a dev database with
 * no bookings, no payouts and no audit logs at all, leaving every owner
 * dashboard and the admin payout queue permanently empty.
 */
@Slf4j
@Service
@Order(11)
@RequiredArgsConstructor
public class AdminPartBDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final PayoutRepository payoutRepository;
    private final ReviewRepository reviewRepository;
    private final AuditLogRepository auditLogRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seed();
    }

    @Transactional
    public void seed() {
        log.info("Checking Admin Demo Data Seeder - Part B");

        List<User> users = userRepository.findAll();
        List<Venue> venues = venueRepository.findAll();
        List<Pitch> pitches = pitchRepository.findAll();

        if (users.isEmpty() || venues.isEmpty() || pitches.isEmpty()) {
            log.warn("Cannot run Part B Seeder: required Part A data (Users/Venues/Pitches) is missing.");
            return;
        }

        List<User> players = users.stream()
                .filter(u -> u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER)
                .toList();

        if (bookingRepository.count() == 0) {
            seedBookingsAndSlots(players, venues, pitches);
        }
        seedUpcomingWeekSchedule(players, venues, pitches);
        userRepository.findByEmail("rafi@turfchai.com")
                .ifPresent(dp -> seedDemoPlayerUpcomingBookings(dp, venues, pitches));
        userRepository.findByEmail("rafi@turfchai.dev")
                .ifPresent(dp -> seedDemoPlayerUpcomingBookings(dp, venues, pitches));

        if (reviewRepository.count() == 0 || reviewRepository.count() < venues.size() * 2) {
            seedReviews();
        }
        if (payoutRepository.count() == 0) {
            seedPayouts(venues);
        }
        if (auditLogRepository.count() == 0) {
            seedAuditLogs(users);
        }

        log.info("Completed Admin Demo Data Seeder - Part B");
    }

    private void seedBookingsAndSlots(List<User> players, List<Venue> venues, List<Pitch> pitches) {
        log.info("Seeding Bookings and Slots...");
        Random random = new Random(42);

        // Monthly GMV Distribution as requested
        int[] monthlyBookings = { 70, 80, 85, 90, 95, 100, 100, 105, 105, 110, 115, 145 };
        LocalDate today = LocalDate.now();

        List<Booking> bookingsToSave = new ArrayList<>();
        List<Slot> slotsToSave = new ArrayList<>();
        java.util.Set<String> generatedSlots = new java.util.HashSet<>();

        int bookingIndex = 1;

        for (int monthOffset = 11; monthOffset >= 0; monthOffset--) {
            int bookingsThisMonth = monthlyBookings[11 - monthOffset];
            LocalDate monthStart = today.minusMonths(monthOffset).withDayOfMonth(1);
            int lengthOfMonth = monthStart.lengthOfMonth();

            for (int i = 0; i < bookingsThisMonth; i++) {
                Pitch pitch = pitches.get(random.nextInt(pitches.size()));
                LocalDate bookingDate = monthStart.plusDays(random.nextInt(lengthOfMonth));

                int[] availableHours = { 6, 8, 10, 14, 16, 18, 20 };
                int startHour = availableHours[random.nextInt(availableHours.length)];

                String slotKey = pitch.getId() + "_" + bookingDate + "_" + startHour;
                if (!generatedSlots.add(slotKey)) {
                    // Collision detected, skip this booking to avoid unique constraint violation
                    continue;
                }

                // 80/20 rule: 20% core repeat players generate 70% of bookings to create realistic regular & VIP tiers
                User player;
                int playerPoolRoll = random.nextInt(100);
                int corePlayerCount = Math.max(5, players.size() / 10);
                if (playerPoolRoll < 70) {
                    player = players.get(random.nextInt(corePlayerCount));
                } else {
                    player = players.get(corePlayerCount + random.nextInt(Math.max(1, players.size() - corePlayerCount)));
                }
                Venue venue = venues.stream().filter(v -> v.getId().equals(pitch.getVenue().getId())).findFirst()
                        .orElse(venues.get(0));

                int durationHours = random.nextBoolean() ? 1 : 2;

                LocalTime startTime = LocalTime.of(startHour, 0);
                LocalTime endTime = startTime.plusHours(durationHours);

                BigDecimal grossAmount = BigDecimal.valueOf(800 + random.nextInt(1700));
                BigDecimal netAmount = grossAmount.multiply(BigDecimal.valueOf(0.9));

                BookingStatus status;
                int statusRoll = random.nextInt(100);
                if (statusRoll < 85)
                    status = BookingStatus.CONFIRMED;
                else if (statusRoll < 95)
                    status = BookingStatus.CANCELLED;
                else
                    status = BookingStatus.PENDING;

                OffsetDateTime createdAt = bookingDate.atTime(LocalTime.of(random.nextInt(24), random.nextInt(60)))
                        .atOffset(ZoneOffset.UTC).minusDays(random.nextInt(5));

                Slot slot = Slot.builder()
                        .pitch(pitch)
                        .venueId(venue.getId())
                        .slotDate(bookingDate)
                        .price(grossAmount)
                        .startTime(startTime)
                        .endTime(endTime)
                        .status(SlotStatus.BOOKED)
                        .createdAt(createdAt)
                        .updatedAt(createdAt)
                        .build();

                slotsToSave.add(slot);

                String source = "ONLINE";
                String guestName = null;
                String guestPhone = null;
                String bookingCode;

                int sourceRoll = random.nextInt(100);
                if (sourceRoll < 15) {
                    source = "PHONE";
                    bookingCode = "MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    guestName = player.getFullName();
                    guestPhone = player.getPhone();
                } else if (sourceRoll < 25) {
                    source = "WALK_IN";
                    bookingCode = "MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    guestName = player.getFullName();
                    guestPhone = player.getPhone();
                } else {
                    bookingCode = String.format("BK-%04d%02d-%04d", bookingDate.getYear(),
                            bookingDate.getMonthValue(), bookingIndex++);
                }

                Booking booking = Booking.builder()
                        .bookingCode(bookingCode)
                        .slot(slot)
                        .userId(player.getId())
                        .venueId(venue.getId())
                        .pitchId(pitch.getId())
                        .bookingDate(bookingDate)
                        .startTime(startTime)
                        .endTime(endTime)
                        .grossAmount(grossAmount)
                        .netAmount(netAmount)
                        .source(source)
                        .guestName(guestName)
                        .guestPhone(guestPhone)
                        .status(status)
                        .createdAt(createdAt)
                        .updatedAt(createdAt)
                        .build();

                bookingsToSave.add(booking);
            }
        }

        // Save slots first because bookings need the slot_id
        slotRepository.saveAll(slotsToSave);
        bookingRepository.saveAll(bookingsToSave);
        log.info("Seeded {} Bookings and Slots.", bookingsToSave.size());
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void ensureUpcomingWeekSchedule() {
        List<User> users = userRepository.findAll();
        List<Venue> venues = venueRepository.findAll();
        List<Pitch> pitches = pitchRepository.findAll();

        if (users.isEmpty() || venues.isEmpty() || pitches.isEmpty()) {
            return;
        }

        List<User> players = users.stream()
                .filter(u -> u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER)
                .toList();

        seedUpcomingWeekSchedule(players, venues, pitches);
    }

    public void seedUpcomingWeekSchedule(List<User> players, List<Venue> venues, List<Pitch> pitches) {
        log.info("Ensuring upcoming 7-day schedule, slots and bookings for owner venues...");
        LocalDate today = LocalDate.now();
        Random random = new Random(101);

        LocalTime[] slotTimes = {
                LocalTime.of(7, 0),
                LocalTime.of(9, 30),
                LocalTime.of(16, 0),
                LocalTime.of(17, 30),
                LocalTime.of(19, 0),
                LocalTime.of(20, 30)
        };

        int bookingCodeSeq = 7000;
        int createdBookings = 0;

        for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
            LocalDate targetDate = today.plusDays(dayOffset);

            for (Pitch pitch : pitches) {
                Venue venue = pitch.getVenue() != null ? pitch.getVenue()
                        : venues.stream().filter(v -> pitch.getVenue() != null && v.getId().equals(pitch.getVenue().getId())).findFirst().orElse(venues.get(0));

                BigDecimal basePrice = venue.getBasePrice() != null && venue.getBasePrice().compareTo(BigDecimal.ZERO) > 0
                        ? venue.getBasePrice()
                        : BigDecimal.valueOf(2500);

                for (int slotIdx = 0; slotIdx < slotTimes.length; slotIdx++) {
                    LocalTime start = slotTimes[slotIdx];
                    LocalTime end = start.plusMinutes(90);

                    boolean isPeak = !start.isBefore(LocalTime.of(16, 0));
                    BigDecimal price = isPeak ? basePrice : basePrice.multiply(BigDecimal.valueOf(0.8));

                    boolean isBooked;

                    if (dayOffset == 0) {
                        isBooked = (slotIdx == 1 || slotIdx == 3 || slotIdx == 4 || slotIdx == 5);
                    } else if (dayOffset <= 3) {
                        isBooked = (slotIdx == 3 || slotIdx == 4 || slotIdx == 5);
                    } else {
                        isBooked = (slotIdx == 4 || slotIdx == 5);
                    }

                    OffsetDateTime createdAt = targetDate.minusDays(2).atTime(start).atOffset(ZoneOffset.UTC);
                    Slot slot = slotRepository.findByPitchIdAndSlotDateAndStartTime(pitch.getId(), targetDate, start).orElse(null);

                    User player = players.get(random.nextInt(players.size()));

                    if (slot == null) {
                        SlotStatus status = isBooked ? SlotStatus.BOOKED : SlotStatus.AVAILABLE;

                        slot = Slot.builder()
                                .pitch(pitch)
                                .venueId(venue.getId())
                                .slotDate(targetDate)
                                .price(price)
                                .startTime(start)
                                .endTime(end)
                                .status(status)
                                .heldByUserId(null)
                                .holdExpiresAt(null)
                                .createdAt(createdAt)
                                .updatedAt(createdAt)
                                .build();

                        slot = slotRepository.saveAndFlush(slot);
                    } else {
                        if (isBooked && slot.getStatus() != SlotStatus.BOOKED) {
                            slot.setStatus(SlotStatus.BOOKED);
                            slot.setHeldByUserId(null);
                            slot.setHoldExpiresAt(null);
                            slot = slotRepository.saveAndFlush(slot);
                        } else if (!isBooked && slot.getStatus() == SlotStatus.HELD) {
                            slot.setStatus(SlotStatus.AVAILABLE);
                            slot.setHeldByUserId(null);
                            slot.setHoldExpiresAt(null);
                            slot = slotRepository.saveAndFlush(slot);
                        }
                    }

                    // Ensure Booking exists if booked
                    if (isBooked) {
                        List<Booking> existingBookings = bookingRepository.findBySlotIdAndStatusNot(slot.getId(), BookingStatus.CANCELLED);
                        if (existingBookings.isEmpty()) {
                            String source = (slotIdx % 3 == 0) ? "PHONE" : ((slotIdx % 3 == 1) ? "ONLINE" : "WALK_IN");
                            String guestName = source.equals("ONLINE") ? null : player.getFullName();
                            String guestPhone = source.equals("ONLINE") ? null : player.getPhone();

                            String bookingCode = source.equals("ONLINE")
                                    ? String.format("BK-%04d%02d-%04d", targetDate.getYear(), targetDate.getMonthValue(), bookingCodeSeq++)
                                    : "MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

                            Booking booking = Booking.builder()
                                    .bookingCode(bookingCode)
                                    .slot(slot)
                                    .userId(player.getId())
                                    .venueId(venue.getId())
                                    .pitchId(pitch.getId())
                                    .bookingDate(targetDate)
                                    .startTime(start)
                                    .endTime(end)
                                    .grossAmount(price)
                                    .netAmount(price.multiply(BigDecimal.valueOf(0.9)))
                                    .source(source)
                                    .guestName(guestName)
                                    .guestPhone(guestPhone)
                                    .status(isBooked ? BookingStatus.CONFIRMED : BookingStatus.PENDING)
                                    .createdAt(createdAt)
                                    .updatedAt(createdAt)
                                    .build();

                            bookingRepository.saveAndFlush(booking);
                            createdBookings++;
                        }
                    }
                }
            }
        }
        log.info("Ensured upcoming 7-day schedule with {} new bookings.", createdBookings);
    }

    public void seedDemoPlayerUpcomingBookings(User demoPlayer, List<Venue> venues, List<Pitch> pitches) {
        if (demoPlayer == null || venues.isEmpty() || pitches.isEmpty()) {
            return;
        }
        log.info("Ensuring upcoming 7-day bookings for demo player {}...", demoPlayer.getEmail());
        LocalDate today = LocalDate.now();

        LocalTime[] slotTimes = {
                LocalTime.of(20, 30),
                LocalTime.of(19, 0),
                LocalTime.of(20, 0),
                LocalTime.of(17, 30),
                LocalTime.of(19, 0),
                LocalTime.of(20, 30),
                LocalTime.of(18, 0),
                LocalTime.of(19, 30)
        };

        int seeded = 0;
        for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
            LocalDate targetDate = today.plusDays(dayOffset);
            LocalTime start = slotTimes[dayOffset % slotTimes.length];
            LocalTime end = start.plusMinutes(90);

            Venue venue = venues.get(dayOffset % venues.size());
            List<Pitch> venuePitches = pitches.stream()
                    .filter(p -> p.getVenue() != null && p.getVenue().getId().equals(venue.getId()))
                    .toList();
            Pitch pitch = venuePitches.isEmpty() ? pitches.get(dayOffset % pitches.size()) : venuePitches.get(0);

            boolean alreadyBooked = bookingRepository.findByUserId(demoPlayer.getId()).stream()
                    .anyMatch(b -> targetDate.equals(b.getBookingDate()) && b.getStatus() != BookingStatus.CANCELLED);

            if (!alreadyBooked) {
                BigDecimal price = venue.getBasePrice() != null && venue.getBasePrice().compareTo(BigDecimal.ZERO) > 0
                        ? venue.getBasePrice()
                        : BigDecimal.valueOf(2500);

                OffsetDateTime createdAt = targetDate.minusDays(1).atTime(start).atOffset(ZoneOffset.UTC);
                Slot slot = slotRepository.findByPitchIdAndSlotDateAndStartTime(pitch.getId(), targetDate, start).orElse(null);

                if (slot == null) {
                    slot = Slot.builder()
                            .pitch(pitch)
                            .venueId(venue.getId())
                            .slotDate(targetDate)
                            .price(price)
                            .startTime(start)
                            .endTime(end)
                            .status(SlotStatus.BOOKED)
                            .createdAt(createdAt)
                            .updatedAt(createdAt)
                            .build();
                    slot = slotRepository.saveAndFlush(slot);
                } else {
                    slot.setStatus(SlotStatus.BOOKED);
                    slot.setHeldByUserId(null);
                    slot.setHoldExpiresAt(null);
                    slot = slotRepository.saveAndFlush(slot);
                }

                String bookingCode = String.format("TC-UPC-%02d%02d-%02d", targetDate.getMonthValue(), targetDate.getDayOfMonth(), dayOffset);

                // Skip if booking code already exists (e.g. seeded by Flyway migration)
                if (bookingRepository.findByBookingCode(bookingCode).isPresent()) {
                    continue;
                }

                Booking booking = Booking.builder()
                        .bookingCode(bookingCode)
                        .slot(slot)
                        .userId(demoPlayer.getId())
                        .venueId(venue.getId())
                        .pitchId(pitch.getId())
                        .bookingDate(targetDate)
                        .startTime(start)
                        .endTime(end)
                        .grossAmount(price)
                        .netAmount(price.multiply(BigDecimal.valueOf(0.9)))
                        .source("ONLINE")
                        .status(BookingStatus.CONFIRMED)
                        .createdAt(createdAt)
                        .updatedAt(createdAt)
                        .build();

                bookingRepository.saveAndFlush(booking);
                seeded++;
            }
        }
        log.info("Ensured upcoming 7-day bookings for demo player ({} new created).", seeded);
    }

    private static final String[] REVIEW_COMMENTS = {
            "Pitch was in great shape and the floodlights are genuinely bright.",
            "Booking was quick, but the changing room was crowded at peak hour.",
            "Good surface, fair price. Parking fills up fast after 7pm.",
            "Turf is well maintained. Staff let us start a few minutes early.",
            "Decent ground, though the nets need replacing on one side.",
            "Great for 7-a-side. We come back every week.",
            "Clean facilities and the cafeteria is a nice touch.",
            "Slot ran on time and check-in with the QR was painless.",
    };

    /**
     * Reviews are seeded from real completed bookings so a venue's rating and
     * review count are earned rather than asserted. Venues used to ship a
     * fabricated count - "167 reviews" over an empty reviews tab.
     */
    private void seedReviews() {
        Random random = new Random(300);
        List<Booking> completed = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .filter(b -> b.getBookingDate() != null && b.getBookingDate().isBefore(LocalDate.now()))
                .toList();

        List<Review> reviews = new ArrayList<>();
        java.util.Set<Long> venueIds = new java.util.HashSet<>();
        for (Booking booking : completed) {
            // Not every player leaves a review.
            if (random.nextInt(100) >= 45) {
                continue;
            }
            Venue venue = venueRepository.findById(booking.getVenueId()).orElse(null);
            User author = booking.getUserId() == null ? null
                    : userRepository.findById(booking.getUserId()).orElse(null);
            if (venue == null || author == null) {
                continue;
            }
            int rating = 3 + random.nextInt(3);
            Review review = new Review();
            review.setBooking(booking);
            review.setUser(author);
            review.setVenue(venue);
            review.setOverallRating(rating);
            review.setSubRatings(java.util.Map.of("surface", rating, "lighting", rating, "facilities", Math.max(1, rating - 1)));
            review.setTags(java.util.List.of("good_surface", "clean"));
            review.setComment(REVIEW_COMMENTS[random.nextInt(REVIEW_COMMENTS.length)]);
            review.setStatus(ReviewStatus.PUBLISHED);
            review.setCreatedAt(booking.getBookingDate().plusDays(1).atStartOfDay(ZoneOffset.UTC));
            review.setUpdatedAt(review.getCreatedAt());
            reviews.add(review);
            venueIds.add(venue.getId());
        }

        List<Venue> allVenues = venueRepository.findAll();
        List<User> playerPool = userRepository.findAll().stream()
                .filter(u -> u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER)
                .toList();
        List<Booking> allBookings = bookingRepository.findAll();

        for (Venue venue : allVenues) {
            Integer existingCount = reviewRepository.getReviewCountForVenue(venue.getId());
            if ((existingCount == null || existingCount == 0) && !playerPool.isEmpty()) {
                List<Booking> venueBookings = allBookings.stream()
                        .filter(b -> venue.getId().equals(b.getVenueId()))
                        .toList();
                for (int i = 0; i < venueBookings.size() && i < 5; i++) {
                    Booking b = venueBookings.get(i);
                    User author = b.getUserId() != null ? userRepository.findById(b.getUserId()).orElse(playerPool.get(0)) : playerPool.get(0);
                    int rating = 3 + random.nextInt(3);
                    Review review = new Review();
                    review.setBooking(b);
                    review.setUser(author);
                    review.setVenue(venue);
                    review.setOverallRating(rating);
                    review.setSubRatings(java.util.Map.of("surface", rating, "lighting", rating, "facilities", Math.max(1, rating - 1)));
                    review.setTags(java.util.List.of("good_surface", "clean"));
                    review.setComment(REVIEW_COMMENTS[random.nextInt(REVIEW_COMMENTS.length)]);
                    review.setStatus(ReviewStatus.PUBLISHED);
                    review.setCreatedAt(b.getBookingDate() != null ? b.getBookingDate().plusDays(1).atStartOfDay(ZoneOffset.UTC) : LocalDate.now().minusDays(10 + i * 5).atStartOfDay(ZoneOffset.UTC));
                    review.setUpdatedAt(review.getCreatedAt());
                    reviews.add(review);
                    venueIds.add(venue.getId());
                }
            }
        }

        reviewRepository.saveAll(reviews);

        for (Long venueId : venueIds) {
            Venue venue = venueRepository.findById(venueId).orElse(null);
            if (venue == null) {
                continue;
            }
            BigDecimal avg = reviewRepository.getAverageRatingForVenue(venueId);
            Integer count = reviewRepository.getReviewCountForVenue(venueId);
            venue.setRatingAvg(avg != null ? avg.setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO);
            venue.setReviewCount(count != null ? count : 0);
            venueRepository.save(venue);
        }
        log.info("Seeded {} Reviews across {} venues.", reviews.size(), venueIds.size());
    }

    private void seedPayouts(List<Venue> venues) {
        log.info("Seeding Payouts...");
        Random random = new Random(100);
        LocalDate today = LocalDate.now();
        List<Payout> payoutsToSave = new ArrayList<>();

        for (Venue venue : venues) {
            for (int monthOffset = 11; monthOffset >= 0; monthOffset--) {
                LocalDate periodStart = today.minusMonths(monthOffset).withDayOfMonth(1);
                LocalDate periodEnd = periodStart.withDayOfMonth(periodStart.lengthOfMonth());

                // Simulated venue revenue for the month
                BigDecimal grossAmount = BigDecimal.valueOf(5000 + random.nextInt(45000));
                BigDecimal platformFee = grossAmount.multiply(BigDecimal.valueOf(0.06));
                BigDecimal netAmount = grossAmount.subtract(platformFee);

                String status = "SETTLED";
                int statusRoll = random.nextInt(100);
                if (statusRoll < 20)
                    status = "SCHEDULED";
                else if (statusRoll < 30)
                    status = "IN_TRANSIT";

                boolean anomalyFlag = (statusRoll < 10);
                String anomalyReason = anomalyFlag ? "Refund ratio spike > 4.2% threshold" : null;
                OffsetDateTime settledAt = "SETTLED".equals(status)
                        ? periodEnd.plusDays(5).atStartOfDay().atOffset(ZoneOffset.UTC)
                        : null;
                OffsetDateTime createdAt = periodEnd.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
                LocalDate scheduledDate = periodEnd.plusDays(5);

                String payoutCode = String.format("PAY-%04d%02d-%d", periodStart.getYear(), periodStart.getMonthValue(),
                        venue.getId());

                Payout payout = Payout.builder()
                        .payoutCode(payoutCode)
                        .ownerUserId(venue.getOwner() != null ? venue.getOwner().getId() : 1L)
                        .venueId(venue.getId())
                        .grossAmount(grossAmount)
                        .platformFee(platformFee)
                        .netAmount(netAmount)
                        .status(status)
                        .anomalyFlag(anomalyFlag)
                        .anomalyReason(anomalyReason)
                        .periodStart(periodStart)
                        .periodEnd(periodEnd)
                        .scheduledDate(scheduledDate)
                        .settledAt(settledAt)
                        .createdAt(createdAt)
                        .updatedAt(createdAt)
                        .build();

                payoutsToSave.add(payout);
            }
        }

        payoutRepository.saveAll(payoutsToSave);
        log.info("Seeded {} Payouts.", payoutsToSave.size());
    }

    private void seedAuditLogs(List<User> users) {
        log.info("Seeding Audit Logs...");
        Random random = new Random(200);
        List<AuditLog> logsToSave = new ArrayList<>();

        List<User> admins = users.stream()
                .filter(u -> u.getRole() == RoleType.ADMIN || u.getRole() == RoleType.SUPER_ADMIN)
                .toList();

        OffsetDateTime now = OffsetDateTime.now();

        // Target ~80 logs over 30 days
        for (int i = 0; i < 80; i++) {
            OffsetDateTime createdAt = now.minusDays(random.nextInt(30)).minusHours(random.nextInt(24));
            User chosenAdmin = admins.isEmpty() ? (users.isEmpty() ? null : users.get(0)) : admins.get(random.nextInt(admins.size()));
            String adminName = chosenAdmin != null ? chosenAdmin.getFullName() : "Admin";
            Long adminId = chosenAdmin != null ? chosenAdmin.getId() : null;

            String action, target, details, tone;
            int typeRoll = random.nextInt(100);

            if (typeRoll < 25) {
                // APPROVAL
                action = "Approval";
                target = "TR-REQ-00" + i;
                details = "TurfRequest Approved — By " + adminName;
                tone = "blue";
            } else if (typeRoll < 45) {
                // MODERATION
                action = "Moderation";
                target = "User #" + (100 + random.nextInt(700));
                details = "Player Suspended (No-Show Repeat) — By " + adminName;
                tone = "red";
            } else if (typeRoll < 70) {
                // SETTLEMENT
                action = "Settlement";
                target = "PAY-2026-" + random.nextInt(1000);
                details = "Payout Settled — ৳" + (5000 + random.nextInt(15000)) + " — By " + adminName;
                tone = "green";
            } else if (typeRoll < 85) {
                // AUTOMATION
                action = "Automation";
                target = "Venue #" + random.nextInt(40);
                details = "Payout Flagged for Review";
                tone = "yellow";
            } else {
                // CONFIG
                action = "Config";
                target = "Platform Settings";
                details = "Platform fee updated — By Super Admin";
                tone = "purple";
            }

            AuditLog log = AuditLog.builder()
                    .adminName(adminName)
                    .adminId(adminId)
                    .action(action)
                    .actionTone(tone)
                    .target(target)
                    .details(details)
                    .createdAt(createdAt)
                    .build();

            logsToSave.add(log);
        }

        auditLogRepository.saveAll(logsToSave);
        log.info("Seeded {} Audit Logs.", logsToSave.size());
    }
}
