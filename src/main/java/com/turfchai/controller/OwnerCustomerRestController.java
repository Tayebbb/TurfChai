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
            
            for (Booking b : bkgs) {
                if (b.getStatus() == BookingStatus.CONFIRMED && b.getGrossAmount() != null) {
                    totalSpend = totalSpend.add(b.getGrossAmount());
                }
                if (lastVisit == null || (b.getBookingDate() != null && b.getBookingDate().isAfter(lastVisit))) {
                    lastVisit = b.getBookingDate();
                }
            }
            
            String initials = user.getFullName() != null && user.getFullName().length() > 0 
                ? user.getFullName().substring(0, 1).toUpperCase() 
                : "?";
                
            String lastVisitStr = lastVisit != null ? lastVisit.toString() : "Never";
            
            Map<String, Object> c = new HashMap<>();
            c.put("id", user.getId().toString());
            c.put("name", user.getFullName());
            c.put("phone", user.getPhone() != null ? user.getPhone() : "N/A");
            c.put("initials", initials);
            c.put("tone", "green"); // Randomize later if needed
            c.put("bookings", bookingCount);
            c.put("spend", "৳" + totalSpend.intValue());
            c.put("last", lastVisitStr);
            c.put("loyalty", "—"); // not implemented in DB
            c.put("noShows", "—"); // not implemented in DB
            
            customers.add(c);
        }
        
        return ResponseEntity.ok(customers);
    }
}
