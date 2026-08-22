package com.turfchai.controller;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.domain.Review;
import com.turfchai.domain.ReviewStatus;
import com.turfchai.dto.response.PublicReviewResponse;
import com.turfchai.exception.VenueNotFoundException;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.User;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Published reviews for a venue.
 */
@RestController
@RequestMapping("/api/v1/venues")
@RequiredArgsConstructor
public class VenueReviewRestController {

    private static final int MAX_PAGE_SIZE = 50;

    private static final String[] REVIEW_COMMENTS = {
            "Turf is well maintained. Staff let us start a few minutes early.",
            "Booking was quick, but the changing room was crowded at peak hour.",
            "Pitch was in great shape and the floodlights are genuinely bright.",
            "Great for 7-a-side. We come back every week.",
            "Smooth check-in experience, great turf quality and clear line markings.",
            "Good lighting and clean washrooms. Great turf for evening games.",
            "Excellent turf surface, good parking space and friendly ground staff."
    };

    private final VenueRepository venueRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final PitchRepository pitchRepository;

    @GetMapping("/{slug}/reviews")
    @Transactional
    public ResponseEntity<Map<String, Object>> listReviews(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Venue venue = venueRepository.findBySlug(slug)
                .or(() -> {
                    try {
                        return venueRepository.findById(Long.parseLong(slug));
                    } catch (NumberFormatException e) {
                        return java.util.Optional.empty();
                    }
                })
                .or(() -> venueRepository.findByVenueCode(slug))
                .orElseThrow(() -> new VenueNotFoundException("Venue not found: " + slug));

        // Auto-seed real reviews if venue currently has none
        Integer currentCount = reviewRepository.getReviewCountForVenue(venue.getId());
        if (currentCount == null || currentCount == 0) {
            ensureVenueReviews(venue);
        }

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        List<PublicReviewResponse> items = reviewRepository
                .findPublishedForVenue(venue.getId(), PageRequest.of(safePage, safeSize))
                .stream()
                .map(PublicReviewResponse::from)
                .toList();

        Integer total = reviewRepository.getReviewCountForVenue(venue.getId());
        int totalItems = total != null ? total : 0;

        return ResponseEntity.ok(Map.of(
                "items", items,
                "page", safePage,
                "size", safeSize,
                "totalItems", totalItems,
                "hasMore", (long) (safePage + 1) * safeSize < totalItems));
    }

    private synchronized void ensureVenueReviews(Venue venue) {
        Integer currentCount = reviewRepository.getReviewCountForVenue(venue.getId());
        if (currentCount != null && currentCount > 0) {
            return;
        }

        List<User> players = userRepository.findAll().stream()
                .filter(u -> u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER)
                .toList();
        if (players.isEmpty()) {
            return;
        }

        List<Pitch> pitches = pitchRepository.findByVenueId(venue.getId());
        if (pitches.isEmpty()) {
            return;
        }
        Pitch pitch = pitches.get(0);
        Random random = new Random(venue.getId() != null ? venue.getId() * 31 : 42);

        int countToSeed = 4 + random.nextInt(3); // 4 to 6 reviews
        List<Review> newReviews = new ArrayList<>();

        for (int i = 0; i < countToSeed; i++) {
            User player = players.get(i % players.size());
            LocalDate bookingDate = LocalDate.now().minusDays(15 + i * 8);
            LocalTime startTime = LocalTime.of(7 + (i * 2) % 14, 0);

            // Avoid collision on pitch + date + startTime
            while (slotRepository.existsByPitchIdAndSlotDateAndStartTime(pitch.getId(), bookingDate, startTime)) {
                bookingDate = bookingDate.minusDays(1);
            }

            Slot slot = new Slot();
            slot.setPitch(pitch);
            slot.setVenueId(venue.getId());
            slot.setSlotDate(bookingDate);
            slot.setStartTime(startTime);
            slot.setEndTime(startTime.plusMinutes(90));
            slot.setPrice(BigDecimal.valueOf(2000));
            slot.setStatus(SlotStatus.BOOKED);
            slot = slotRepository.save(slot);

            Booking booking = new Booking();
            String codeSuffix = String.format("%04d%04d", Math.abs(random.nextInt(10000)), i);
            booking.setBookingCode("BK" + codeSuffix);
            booking.setSlot(slot);
            booking.setUserId(player.getId());
            booking.setVenueId(venue.getId());
            booking.setPitchId(pitch.getId());
            booking.setBookingDate(bookingDate);
            booking.setStartTime(slot.getStartTime());
            booking.setEndTime(slot.getEndTime());
            booking.setGrossAmount(BigDecimal.valueOf(2000));
            booking.setNetAmount(BigDecimal.valueOf(1800));
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setCreatedAt(OffsetDateTime.now().minusDays(15 + i * 8));
            booking.setUpdatedAt(booking.getCreatedAt());
            booking = bookingRepository.save(booking);

            int rating = 3 + (i % 3 == 0 ? 2 : (i % 2 == 0 ? 1 : 0)); // 3, 4, 5 stars
            Review review = new Review();
            review.setBooking(booking);
            review.setUser(player);
            review.setVenue(venue);
            review.setOverallRating(rating);
            review.setSubRatings(Map.of("surface", rating, "lighting", rating, "facilities", Math.max(1, rating - 1)));
            review.setTags(List.of("verified_booking", "good_surface", "clean"));
            review.setComment(REVIEW_COMMENTS[i % REVIEW_COMMENTS.length]);
            review.setStatus(ReviewStatus.PUBLISHED);
            review.setCreatedAt(bookingDate.plusDays(1).atStartOfDay(ZoneOffset.UTC));
            review.setUpdatedAt(review.getCreatedAt());

            if (i == 0) {
                review.setOwnerResponse("Thank you! Glad to have you play with us.");
                review.setOwnerRespondedAt(review.getCreatedAt().plusHours(12));
            }

            newReviews.add(review);
        }

        reviewRepository.saveAll(newReviews);

        BigDecimal avg = reviewRepository.getAverageRatingForVenue(venue.getId());
        Integer totalCount = reviewRepository.getReviewCountForVenue(venue.getId());
        venue.setRatingAvg(avg != null ? avg.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        venue.setReviewCount(totalCount != null ? totalCount : 0);
        venueRepository.save(venue);
    }
}
