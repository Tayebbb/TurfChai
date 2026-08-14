package com.turfchai.payment.api;

import com.turfchai.dto.ApiResponse;
import com.turfchai.payment.dto.request.CheckoutRequest;
import com.turfchai.payment.dto.response.CancelRefundResponse;
import com.turfchai.payment.dto.response.CheckoutResponse;
import com.turfchai.payment.dto.response.PaymentResponse;
import com.turfchai.payment.dto.response.RefundPreviewResponse;
import com.turfchai.payment.service.PaymentService;
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

import java.util.List;

/**
 * Mock payment gateway + refund API. Every endpoint resolves the caller
 * from the JWT security principal (falls under {@code SecurityConfig}'s
 * {@code anyRequest().authenticated()} catch-all — same as
 * {@code /api/v1/bookings/**}, no explicit rule needed). Error handling is
 * delegated to {@link com.turfchai.exception.GlobalExceptionHandler}.
 */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentRestController {

    private final PaymentService paymentService;

    /** POST /api/v1/payments/checkout — pay for the caller's currently held slot. */
    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<CheckoutResponse>> checkout(
            Authentication authentication,
            @Valid @RequestBody CheckoutRequest request) {
        CheckoutResponse result = paymentService.pay(currentUserId(authentication), request.getSlotId(),
                request.getMethod(), request.getApplyWalletAmount(), request.isSimulateFailure());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /** GET /api/v1/payments/booking/{bookingId} — a booking's payment history, most recent first. */
    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> paymentsForBooking(
            Authentication authentication, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.getPaymentsForBooking(currentUserId(authentication), bookingId)));
    }

    /** GET /api/v1/payments/refund-preview/{bookingId} — refund %/amount before the caller confirms cancellation. */
    @GetMapping("/refund-preview/{bookingId}")
    public ResponseEntity<ApiResponse<RefundPreviewResponse>> refundPreview(
            Authentication authentication, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.previewRefund(currentUserId(authentication), bookingId)));
    }

    /** POST /api/v1/payments/cancel/{bookingId} — cancels the booking and records the refund, if any. */
    @PostMapping("/cancel/{bookingId}")
    public ResponseEntity<ApiResponse<CancelRefundResponse>> cancel(
            Authentication authentication, @PathVariable Long bookingId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.cancelAndRefund(currentUserId(authentication), bookingId)));
    }

    private Long currentUserId(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return principal.getId();
    }
}
