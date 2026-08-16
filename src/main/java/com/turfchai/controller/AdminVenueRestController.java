package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.dto.response.AdminVenueResponse;
import com.turfchai.exception.VenueNotFoundException;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuditLogService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/venues")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*")
public class AdminVenueRestController {

    /** The venue lifecycle the platform recognises; anything else is a client bug. */
    private static final java.util.Set<String> ALLOWED_VENUE_STATUSES =
            java.util.Set.of("DRAFT", "LIVE", "SUSPENDED", "ARCHIVED");

    private final VenueRepository venueRepository;
    private final AuditLogService auditLogService;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    // Read-only transaction so AdminVenueResponse can resolve the lazy owner
    // association; projecting it after the session closed is exactly the
    // failure TC-005 described.
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<AdminVenueResponse>>> listVenues(@RequestParam(required = false) String status) {
        List<Venue> list;
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            list = venueRepository.findAll().stream()
                    .filter(v -> v.getStatus() != null && v.getStatus().equalsIgnoreCase(status))
                    .toList();
        } else {
            list = venueRepository.findAll();
        }
        return ResponseEntity.ok(ApiResponse.ok(list.stream().map(AdminVenueResponse::from).toList()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<AdminVenueResponse>> getVenue(@PathVariable Long id) {
        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new VenueNotFoundException("Venue not found with id " + id));
        return ResponseEntity.ok(ApiResponse.ok(AdminVenueResponse.from(venue)));
    }

    /**
     * Real 30-day trade for one venue plus the 7-day demand trend behind the
     * chart. The admin venue screen had no source for any of this, so it either
     * showed an invented figure or drew a flat line of zeros labelled "live".
     */
    @GetMapping("/{id}/analytics")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getVenueAnalytics(@PathVariable Long id) {
        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new VenueNotFoundException("Venue not found with id " + id));

        LocalDate today = LocalDate.now();
        LocalDate windowStart = today.minusDays(29);
        List<Booking> bookings = bookingRepository.findByVenueIdIn(List.of(venue.getId()));

        int bookings30d = 0;
        BigDecimal revenue30d = BigDecimal.ZERO;
        for (Booking b : bookings) {
            LocalDate date = b.getBookingDate();
            if (date == null || date.isBefore(windowStart) || date.isAfter(today)) {
                continue;
            }
            if (b.getStatus() == BookingStatus.CONFIRMED) {
                bookings30d++;
                if (b.getGrossAmount() != null) {
                    revenue30d = revenue30d.add(b.getGrossAmount());
                }
            }
        }

        List<Slot> slots = slotRepository.findByVenueIdInAndSlotDateBetween(List.of(venue.getId()), windowStart, today);
        long bookedSlots = slots.stream().filter(s -> s.getStatus() == SlotStatus.BOOKED).count();
        Integer occupancyPercent = slots.isEmpty() ? null : (int) Math.round(100.0 * bookedSlots / slots.size());

        // Trend: confirmed bookings per day for the last 7 days, oldest first.
        List<String> trendLabels = new java.util.ArrayList<>();
        List<Integer> trendCounts = new java.util.ArrayList<>();
        for (int offset = 6; offset >= 0; offset--) {
            LocalDate day = today.minusDays(offset);
            trendLabels.add(day.format(java.time.format.DateTimeFormatter.ofPattern("EEE")));
            int count = 0;
            for (Booking b : bookings) {
                if (day.equals(b.getBookingDate()) && b.getStatus() == BookingStatus.CONFIRMED) {
                    count++;
                }
            }
            trendCounts.add(count);
        }

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("bookings30d", bookings30d);
        body.put("revenue30d", revenue30d);
        body.put("occupancyPercent", occupancyPercent);
        body.put("slotsPublished30d", slots.size());
        body.put("trendLabels", trendLabels);
        body.put("trendCounts", trendCounts);
        return ResponseEntity.ok(ApiResponse.ok(body));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<AdminVenueResponse>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String newStatus = payload.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("Status field is required");
        }
        if (!ALLOWED_VENUE_STATUSES.contains(newStatus.toUpperCase())) {
            throw new IllegalArgumentException("Status must be one of " + ALLOWED_VENUE_STATUSES);
        }

        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new VenueNotFoundException("Venue not found with id " + id));

        venue.setStatus(newStatus.toUpperCase());
        Venue saved = venueRepository.save(venue);

        String tone = "ARCHIVED".equalsIgnoreCase(newStatus) || "SUSPENDED".equalsIgnoreCase(newStatus) ? "red" : "green";
        auditLogService.logAction(
                principal.getUsername(),
                principal.getId(),
                "Venue Status Updated",
                tone,
                "V-" + id,
                "Venue " + venue.getName() + " status changed to " + newStatus.toUpperCase()
        );

        return ResponseEntity.ok(ApiResponse.ok(AdminVenueResponse.from(saved)));
    }
}
