package com.turfchai.booking.api;

import com.turfchai.booking.dto.request.HoldSlotRequest;
import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.service.BookingService;
import com.turfchai.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Booking engine REST API. Every endpoint resolves the caller from the JWT
 * security principal, so the routes live under {@code /api/v1/bookings/**},
 * which is not part of SecurityConfig's public path list.
 */
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingRestController {

    private final BookingService bookingService;

    /** Acquires a 5-minute hold on a slot. */
    @PostMapping("/hold-slot")
    public ResponseEntity<Map<String, Object>> holdSlot(
            Authentication authentication,
            @Valid @RequestBody HoldSlotRequest request) {
        OffsetDateTime heldUntil = bookingService.holdSlot(currentUserId(authentication), request.getSlotId());
        return ResponseEntity.ok(Map.of("slotId", request.getSlotId(), "heldUntil", heldUntil));
    }

    /** Confirms the caller's hold and creates a booking. */
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            Authentication authentication,
            @Valid @RequestBody HoldSlotRequest request) {
        Booking booking = bookingService.confirmBooking(currentUserId(authentication), request.getSlotId());
        return ResponseEntity.ok(toResponse(booking));
    }

    /** Cancels a booking owned by the caller (or an admin/owner role). */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelBooking(Authentication authentication, @PathVariable Long id) {
        bookingService.cancelBooking(currentUserId(authentication), id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBooking(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(toResponse(bookingService.getBooking(currentUserId(authentication), id)));
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> listBookings(Authentication authentication) {
        List<BookingResponse> bookings = bookingService.listUserBookings(currentUserId(authentication))
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(bookings);
    }

    private Long currentUserId(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return principal.getId();
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
                .build();
    }
}
