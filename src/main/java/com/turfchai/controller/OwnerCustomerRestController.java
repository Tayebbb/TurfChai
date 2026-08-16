package com.turfchai.controller;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.UserPrincipal;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
@Transactional(readOnly = true)
public class OwnerCustomerRestController {

    private final VenueRepository venueRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOwnerCustomers(
            @AuthenticationPrincipal UserPrincipal principal) {
        
        List<Venue> ownerVenues = venueRepository.findByOwnerId(principal.getId());
        if (ownerVenues.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        
        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        List<Booking> allBookings = bookingRepository.findByVenueIdIn(venueIds);
        
        // Group by user
        Map<Long, List<Booking>> userBookings = allBookings.stream()
            .collect(Collectors.groupingBy(Booking::getUserId));
            
        List<Map<String, Object>> customers = new ArrayList<>();
        
        for (Map.Entry<Long, List<Booking>> entry : userBookings.entrySet()) {
            Long userId = entry.getKey();
            List<Booking> bkgs = entry.getValue();
            
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) continue;
            
            int bookingCount = bkgs.size();
            BigDecimal totalSpend = BigDecimal.ZERO;
            java.time.LocalDate lastVisit = null;
            int confirmedVisits = 0;
            
            for (Booking b : bkgs) {
                if (b.getStatus() == BookingStatus.CONFIRMED && b.getGrossAmount() != null) {
                    totalSpend = totalSpend.add(b.getGrossAmount());
                }
                // A visit is a match that has actually been played. Counting every
                // confirmed booking made this column credit people with visits
                // they had not made yet, and "last visit" then showed a date in
                // the future -- next to a loyalty badge built on the same count.
                if (hasBeenPlayed(b)) {
                    confirmedVisits++;
                    if (lastVisit == null || b.getBookingDate().isAfter(lastVisit)) {
                        lastVisit = b.getBookingDate();
                    }
                }
            }
            
            String initials = user.getFullName() != null && user.getFullName().length() > 0 
                ? user.getFullName().substring(0, 1).toUpperCase() 
                : "?";
                
            String lastVisitStr = lastVisit != null ? lastVisit.toString() : "Never";
            int noShows = user.getGamesNoShow() != null ? user.getGamesNoShow() : 0;
            
            Map<String, Object> c = new HashMap<>();
            c.put("id", user.getId().toString());
            c.put("name", user.getFullName());
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
            
            customers.add(c);
        }
        
        return ResponseEntity.ok(customers);
    }

    /** A confirmed booking whose kick-off has passed — the only thing that counts as a visit. */
    private boolean hasBeenPlayed(Booking booking) {
        if (booking.getStatus() != BookingStatus.CONFIRMED || booking.getBookingDate() == null) {
            return false;
        }
        java.time.LocalTime start = booking.getStartTime() != null
                ? booking.getStartTime()
                : java.time.LocalTime.MIDNIGHT;
        return booking.getBookingDate().atTime(start).isBefore(java.time.LocalDateTime.now());
    }

    /**
     * Standing at THIS owner's venues, counted from completed bookings. There is
     * no venue-loyalty programme in the schema, so nothing here is invented: the
     * badge is just a label on the visit count already shown in the next column.
     */
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
