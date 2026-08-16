package com.turfchai.booking.api;

import com.turfchai.booking.dto.response.OwnerBookingResponse;
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
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/v1/owner/bookings")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Transactional
public class OwnerBookingRestController {

    private final BookingService bookingService;
    private final com.turfchai.payment.service.PaymentService paymentService;
    private final com.turfchai.repository.UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<OwnerBookingResponse>> listOwnerBookings(
            @AuthenticationPrincipal UserPrincipal principal) {
        List<OwnerBookingResponse> bookings = bookingService.listOwnerBookings(principal.getId())
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

    /**
     * Cancels a confirmed booking and records the refund the venue's policy
     * allows. The refund engine already existed for player-initiated cancels;
     * the owner console had a Refund button with nothing behind it.
     */
    @PostMapping("/{id}/refund")
    public ResponseEntity<com.turfchai.payment.dto.response.CancelRefundResponse> refundBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.ok(paymentService.cancelAndRefund(principal.getId(), id));
    }

    private OwnerBookingResponse toResponse(Booking booking) {
        boolean isManual = booking.getBookingCode() != null && booking.getBookingCode().startsWith("MB-");
        String customerName = "Guest";
        String phone = "";
        if (booking.getUserId() != null) {
            com.turfchai.model.User user = userRepository.findById(booking.getUserId()).orElse(null);
            if (user != null) {
                customerName = user.getFullName();
                phone = user.getPhone();
            }
        }
        if (isManual && (customerName.equalsIgnoreCase("Guest") || customerName.toLowerCase().contains("owner")
                || customerName.toLowerCase().contains("admin"))) {
            customerName = "Manual Booking (Walk-in / Phone)";
            phone = "Venue direct";
        }

        java.time.format.DateTimeFormatter timeFormatter = java.time.format.DateTimeFormatter.ofPattern("h:mm a",
                java.util.Locale.ENGLISH);
        String timeStr = booking.getStartTime() != null ? booking.getStartTime().format(timeFormatter) : "N/A";

        String statusTone = "neutral";
        String statusText = "Unknown";
        if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CONFIRMED) {
            statusTone = "green";
            statusText = isManual ? "Paid (Cash)" : "Paid";
        } else if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.PENDING) {
            statusTone = "amber";
            statusText = "Pending";
        } else if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CANCELLED) {
            statusTone = "red";
            statusText = "Cancelled";
        }

        java.util.List<java.util.Map<String, String>> actions = new java.util.ArrayList<>();
        if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.PENDING) {
            // `action` is the operation the row performs. It used to be a
            // `toast` string, so the UI could only announce success.
            actions.add(java.util.Map.of("variant", "primary", "label", "Approve", "action", "approve"));
            actions.add(java.util.Map.of("variant", "secondary", "label", "Cancel", "action", "cancel"));
        } else if (booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CONFIRMED) {
            actions.add(java.util.Map.of("variant", "secondary", "label", "Refund", "action", "refund"));
        }

        Map<String, String> sourceMap = isManual
                ? java.util.Map.of("tone", "amber", "text", "Phone / Walk-in")
                : java.util.Map.of("tone", "green", "text", "Online");

        return OwnerBookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .slotId(booking.getSlot() != null ? booking.getSlot().getId() : null)
                .userId(booking.getUserId())
                .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                .customer(customerName)
                .sub(phone)
                .subNum(true)
                .pitch(booking.getSlot() != null && booking.getSlot().getPitch() != null
                        ? booking.getSlot().getPitch().getName()
                        : "Pitch")
                .time(timeStr)
                .source(sourceMap)
                .amountFormatted("৳" + (booking.getGrossAmount() != null ? booking.getGrossAmount().intValue() : 0))
                .payment(java.util.Map.of("tone", statusTone, "text", statusText))
                .actions(actions)
                .dim(booking.getStatus() == com.turfchai.booking.entity.BookingStatus.CANCELLED)
                .build();
    }
}
