package com.turfchai.controller;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.OwnerCustomerNote;
import com.turfchai.model.User;
import com.turfchai.promotion.entity.Promotion;
import com.turfchai.promotion.repository.PromotionRepository;
import com.turfchai.repository.OwnerCustomerNoteRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.NotificationService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/owner/customers")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class OwnerCustomerRestController {

    private final VenueRepository venueRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final OwnerCustomerNoteRepository ownerCustomerNoteRepository;
    private final PromotionRepository promotionRepository;
    private final NotificationService notificationService;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getOwnerCustomers(
            @AuthenticationPrincipal UserPrincipal principal) {

        List<Venue> ownerVenues = venueRepository.findByOwnerId(principal.getId());
        if (ownerVenues.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        List<Booking> allBookings = bookingRepository.findByVenueIdIn(venueIds);

        // Group notes by customer
        Map<Long, String> notesMap = ownerCustomerNoteRepository.findByOwnerId(principal.getId())
                .stream()
                .collect(Collectors.toMap(OwnerCustomerNote::getCustomerId, OwnerCustomerNote::getNote, (a, b) -> b));

        // Group by user
        Map<Long, List<Booking>> userBookings = allBookings.stream()
                .collect(Collectors.groupingBy(Booking::getUserId));

        List<Map<String, Object>> customers = new ArrayList<>();

        for (Map.Entry<Long, List<Booking>> entry : userBookings.entrySet()) {
            Long userId = entry.getKey();
            List<Booking> bkgs = entry.getValue();

            User user = userRepository.findById(userId).orElse(null);
            if (user == null)
                continue;

            int bookingCount = bkgs.size();
            BigDecimal totalSpend = BigDecimal.ZERO;
            java.time.LocalDate lastVisit = null;
            int confirmedVisits = 0;

            for (Booking b : bkgs) {
                if (b.getStatus() == BookingStatus.CONFIRMED && b.getGrossAmount() != null) {
                    totalSpend = totalSpend.add(b.getGrossAmount());
                }
                if (hasBeenPlayed(b)) {
                    confirmedVisits++;
                    if (lastVisit == null || b.getBookingDate().isAfter(lastVisit)) {
                        lastVisit = b.getBookingDate();
                    }
                }
            }

            String initials = user.getFullName() != null && !user.getFullName().isEmpty()
                    ? user.getFullName().substring(0, 1).toUpperCase()
                    : "?";

            String lastVisitStr = lastVisit != null ? lastVisit.toString() : "Never";
            int noShows = user.getGamesNoShow() != null ? user.getGamesNoShow() : 0;

            Map<String, Object> c = new HashMap<>();
            c.put("id", user.getId().toString());
            c.put("name", user.getFullName());
            c.put("email", user.getEmail() != null ? user.getEmail() : "");
            c.put("phone", user.getPhone() != null ? user.getPhone() : "N/A");
            c.put("initials", initials);
            c.put("tone", "green");
            c.put("bookings", bookingCount);
            c.put("confirmedVisits", confirmedVisits);
            c.put("spend", "৳" + totalSpend.intValue());
            c.put("lastVisit", lastVisitStr);
            c.put("loyalty", loyaltyBadge(confirmedVisits));
            c.put("noShows", noShows);
            c.put("noShowsDanger", noShows >= 3);
            c.put("note", notesMap.getOrDefault(userId, ""));

            customers.add(c);
        }

        return ResponseEntity.ok(customers);
    }

    @PutMapping("/{customerId}/note")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateCustomerNote(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long customerId,
            @RequestBody Map<String, String> body) {

        String noteText = body.getOrDefault("note", "").trim();
        OwnerCustomerNote note = ownerCustomerNoteRepository
                .findByOwnerIdAndCustomerId(principal.getId(), customerId)
                .orElse(OwnerCustomerNote.builder()
                        .ownerId(principal.getId())
                        .customerId(customerId)
                        .note("")
                        .build());

        note.setNote(noteText);
        ownerCustomerNoteRepository.save(note);

        return ResponseEntity.ok(Map.of(
                "customerId", customerId.toString(),
                "note", noteText,
                "success", true));
    }

    @PostMapping("/{customerId}/reward")
    @Transactional
    public ResponseEntity<Map<String, Object>> rewardCustomer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long customerId) {

        List<Venue> ownerVenues = venueRepository.findByOwnerId(principal.getId());
        if (ownerVenues.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No venues found for owner"));
        }

        User user = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

        Venue primaryVenue = ownerVenues.get(0);
        Promotion promo = getOrCreateLoyaltyPromo(primaryVenue);

        sendRewardEmailAndNotification(user, primaryVenue, promo);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "code", promo.getCode(),
                "customerName", user.getFullName(),
                "message", "10% off coupon (" + promo.getCode() + ") emailed to " + user.getFullName() + "!"));
    }

    @PostMapping("/reward-regulars")
    @Transactional
    public ResponseEntity<Map<String, Object>> rewardAllRegulars(
            @AuthenticationPrincipal UserPrincipal principal) {

        List<Venue> ownerVenues = venueRepository.findByOwnerId(principal.getId());
        if (ownerVenues.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No venues found for owner"));
        }

        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        List<Booking> allBookings = bookingRepository.findByVenueIdIn(venueIds);

        // Group by user and count played matches
        Map<Long, Long> playedVisitsByUser = allBookings.stream()
                .filter(this::hasBeenPlayed)
                .collect(Collectors.groupingBy(Booking::getUserId, Collectors.counting()));

        Venue primaryVenue = ownerVenues.get(0);
        Promotion promo = getOrCreateLoyaltyPromo(primaryVenue);

        int rewardedCount = 0;
        for (Map.Entry<Long, Long> entry : playedVisitsByUser.entrySet()) {
            if (entry.getValue() >= 4) { // Regulars have 4+ visits
                User user = userRepository.findById(entry.getKey()).orElse(null);
                if (user != null) {
                    sendRewardEmailAndNotification(user, primaryVenue, promo);
                    rewardedCount++;
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "code", promo.getCode(),
                "rewardedCount", rewardedCount,
                "message", "10% off coupon (" + promo.getCode() + ") emailed to " + rewardedCount
                        + " regular customers!"));
    }

    private Promotion getOrCreateLoyaltyPromo(Venue venue) {
        return promotionRepository.findByVenueIdAndCode(venue.getId(), "LOYAL10")
                .orElseGet(() -> {
                    Promotion p = new Promotion();
                    p.setVenue(venue);
                    p.setCode("LOYAL10");
                    p.setLabel("Loyalty Reward - 10% Off");
                    p.setDiscountType("PERCENT");
                    p.setDiscountValue(new BigDecimal("10.00"));
                    p.setMinOrderAmount(BigDecimal.ZERO);
                    p.setValidFrom(Instant.now());
                    p.setValidUntil(Instant.now().plus(60, ChronoUnit.DAYS));
                    p.setActive(true);
                    p.setUsageLimit(null);
                    return promotionRepository.save(p);
                });
    }

    private void sendRewardEmailAndNotification(User user, Venue venue, Promotion promo) {
        String subject = "🎁 10% Off Loyalty Reward from " + venue.getName();
        String body = "Hi " + user.getFullName() + ",\n\n"
                + "Thank you for being a loyal player at " + venue.getName() + "! "
                + "As a token of our appreciation, here is an exclusive 10% discount coupon for your next booking:\n\n"
                + "🎫 Coupon Code: " + promo.getCode() + "\n"
                + "💰 Discount: 10% off\n\n"
                + "Apply this code at checkout on your next game at " + venue.getName() + ".\n\n"
                + "See you on the pitch!\n"
                + "— " + venue.getName();

        notificationService.send(
                user.getId(),
                "PROMOTION",
                subject,
                body,
                "/venues/" + venue.getId());
    }

    private boolean hasBeenPlayed(Booking booking) {
        if (booking.getStatus() != BookingStatus.CONFIRMED || booking.getBookingDate() == null) {
            return false;
        }
        java.time.LocalTime start = booking.getStartTime() != null
                ? booking.getStartTime()
                : java.time.LocalTime.MIDNIGHT;
        return booking.getBookingDate().atTime(start).isBefore(java.time.LocalDateTime.now());
    }

    private Map<String, String> loyaltyBadge(int confirmedVisits) {
        if (confirmedVisits >= 10) {
            return Map.of("tone", "green", "text", "VIP · " + confirmedVisits + " visits");
        }
        if (confirmedVisits >= 4) {
            return Map.of("tone", "blue", "text", "Regular · " + confirmedVisits + " visits");
        }
        return Map.of("tone", "gray", "text", confirmedVisits == 1 ? "1 visit" : confirmedVisits + " visits");
    }
}
