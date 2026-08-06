package com.turfchai.booking.api;

import com.turfchai.booking.dto.request.HoldSlotRequest;
import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.booking.service.BookingService;
import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import java.util.HashMap;
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
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Bookings", description = "Slot hold and booking lifecycle endpoints")
public class BookingRestController {

    private final BookingService bookingService;
    private final SlotRepository slotRepository;

    /**
     * Acquires a 5-minute hold on a slot. The response is enriched with the
     * slot's price/date/time (and venue/pitch ids) — additive on top of the
     * original {@code slotId}/{@code heldUntil} shape — so checkout can show
     * a real price before charging the caller, instead of a hardcoded one.
     */
    @Operation(summary = "Hold a slot", description = "Acquires a 5-minute exclusive hold on the given slot so it can be confirmed into a booking.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Slot held; returns slotId, heldUntil, and the slot's price/date/time"),
            @ApiResponse(responseCode = "400", description = "Validation failed (missing slotId)"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT"),
            @ApiResponse(responseCode = "409", description = "Slot not found or not available for booking")
    })
    @PostMapping("/hold-slot")
    public ResponseEntity<Map<String, Object>> holdSlot(
            Authentication authentication,
            @Valid @RequestBody HoldSlotRequest request) {
        OffsetDateTime heldUntil = bookingService.holdSlot(currentUserId(authentication), request.getSlotId());

        Map<String, Object> body = new HashMap<>();
        body.put("slotId", request.getSlotId());
        body.put("heldUntil", heldUntil);
        slotRepository.findByIdWithPitch(request.getSlotId()).ifPresent(slot -> {
            body.put("price", slot.getPrice());
            body.put("venueId", slot.getVenueId());
            body.put("pitchId", slot.getPitch() != null ? slot.getPitch().getId() : null);
            body.put("pitchName", slot.getPitch() != null ? slot.getPitch().getName() : null);
            body.put("slotDate", slot.getSlotDate());
            body.put("startTime", slot.getStartTime());
            body.put("endTime", slot.getEndTime());
        });
        return ResponseEntity.ok(body);
    }

    /** Confirms the caller's hold and creates a booking. */
    @Operation(summary = "Confirm hold and create booking", description = "Converts the caller's active hold on the slot into a confirmed booking with a generated booking code.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Booking created and returned"),
            @ApiResponse(responseCode = "400", description = "Validation failed (missing slotId)"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT"),
            @ApiResponse(responseCode = "409", description = "Slot not found, or hold is invalid, not owned by the caller, or expired")
    })
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            Authentication authentication,
            @Valid @RequestBody HoldSlotRequest request) {
        Booking booking = bookingService.confirmBooking(currentUserId(authentication), request.getSlotId());
        return ResponseEntity.ok(toResponse(booking));
    }

    /** Cancels a booking owned by the caller (or an admin/owner role). */
    @Operation(summary = "Cancel a booking", description = "Cancels the caller's booking and releases its slot back to available. Requires the booking owner or an admin/owner role.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Booking cancelled"),
            @ApiResponse(responseCode = "400", description = "Invalid booking id in path"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT"),
            @ApiResponse(responseCode = "403", description = "Caller does not own the booking and is not an admin/owner"),
            @ApiResponse(responseCode = "409", description = "Booking not found")
    })
    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelBooking(Authentication authentication, @PathVariable Long id) {
        bookingService.cancelBooking(currentUserId(authentication), id);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Get a booking", description = "Returns a booking to its owner, or to an admin/owner role.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Booking returned"),
            @ApiResponse(responseCode = "400", description = "Invalid booking id in path"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT"),
            @ApiResponse(responseCode = "409", description = "Booking not found or caller is not allowed to view it")
    })
    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBooking(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(toResponse(bookingService.getBooking(currentUserId(authentication), id)));
    }

    @Operation(summary = "List the caller's bookings", description = "Returns all bookings belonging to the authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List of the caller's bookings"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    })
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
                .venueId(booking.getVenueId())
                .pitchId(booking.getPitchId())
                .bookingDate(booking.getBookingDate())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .netAmount(booking.getNetAmount())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }
}
