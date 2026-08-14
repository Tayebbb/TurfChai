package com.turfchai.booking.api;

import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.service.BookingService;
import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/v1/owner/bookings")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Transactional
public class OwnerBookingRestController {

    private final BookingService bookingService;

    @GetMapping
    public ResponseEntity<List<BookingResponse>> listOwnerBookings(
            @AuthenticationPrincipal UserPrincipal principal) {
        List<BookingResponse> bookings = bookingService.listOwnerBookings(principal.getId())
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(bookings);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approveBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {
        bookingService.approveBooking(principal.getId(), id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {
        bookingService.cancelBooking(principal.getId(), id);
        return ResponseEntity.ok().build();
    }

    private BookingResponse toResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .slotId(booking.getSlot() != null ? booking.getSlot().getId() : null)
                .userId(booking.getUserId())
                .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .title("Booking " + booking.getBookingCode())
                .venue(booking.getSlot() != null ? booking.getSlot().getPitch().getVenue().getName() : "Venue")
                .pitch(booking.getSlot() != null ? booking.getSlot().getPitch().getName() : "Pitch")
                .date(booking.getBookingDate() != null ? booking.getBookingDate().toString() : "Date")
                .time(booking.getStartTime() != null ? booking.getStartTime().toString() : "Time")
                .duration("60 min")
                .share("\u09F3" + booking.getGrossAmount() + " paid")
                .build();
    }
}
