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
@Profile({ "dev", "ci" })
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
        if (bookingRepository.count() > 0) {
            log.info("Part B data already seeded. Skipping.");
            return;
        }

        log.info("Starting Admin Demo Data Seeder - Part B");

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

        seedBookingsAndSlots(players, venues, pitches);
        seedReviews();
        seedPayouts(venues);
        seedAuditLogs(users);

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

                User player = players.get(random.nextInt(players.size()));
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

                String bookingCode = String.format("BK-%04d%02d-%04d", bookingDate.getYear(),
                        bookingDate.getMonthValue(), bookingIndex++);

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
            review.setComment(REVIEW_COMMENTS[random.nextInt(REVIEW_COMMENTS.length)]);
            review.setStatus(ReviewStatus.published);
            review.setCreatedAt(booking.getBookingDate().plusDays(1).atStartOfDay(ZoneOffset.UTC));
            review.setUpdatedAt(review.getCreatedAt());
            reviews.add(review);
            venueIds.add(venue.getId());
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
                    status = "PENDING";
                else if (statusRoll < 30)
                    status = "FLAGGED";

                boolean anomalyFlag = "FLAGGED".equals(status);
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

        String[] adminNames = { "Admin Sakib", "Admin Ayesha", "Admin Rahman", "System" };
        OffsetDateTime now = OffsetDateTime.now();

        // Target ~80 logs over 30 days
        for (int i = 0; i < 80; i++) {
            OffsetDateTime createdAt = now.minusDays(random.nextInt(30)).minusHours(random.nextInt(24));
            String adminName = adminNames[random.nextInt(adminNames.length)];

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
                    .adminId(1L)
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
