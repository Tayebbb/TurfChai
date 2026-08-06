package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.service.BookingService;
import com.turfchai.payment.dto.response.CancelRefundResponse;
import com.turfchai.payment.dto.response.CheckoutResponse;
import com.turfchai.payment.dto.response.PaymentResponse;
import com.turfchai.payment.dto.response.RefundPreviewResponse;
import com.turfchai.payment.entity.Payment;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.reward.entity.PointLedgerEntry;
import com.turfchai.reward.entity.PointReason;
import com.turfchai.reward.service.RewardService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Mock bKash/Nagad payment gateway + refund orchestration. There is no real
 * payment provider to call in this environment, so "the gateway" is
 * simulated here: it always succeeds, except when the caller explicitly
 * asks for a decline (wires the "Simulate failed payment" button already
 * in the checkout UI) — see {@code the-reward-page-is-eager-frog.md} plan
 * for why a randomized failure rate wasn't used instead.
 * <p>
 * Payment gates booking confirmation: {@link BookingService#createPendingBooking}
 * creates a {@code PENDING} booking ahead of the charge, and only a
 * successful payment calls {@link BookingService#finalizeConfirmedBooking}.
 * A declined payment leaves the booking {@code PENDING} and the slot hold
 * untouched, so the caller can simply retry.
 * </p>
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final int TXN_REF_MAX_ATTEMPTS = 10;

    private final PaymentRepository paymentRepository;
    private final BookingService bookingService;
    private final VenueRepository venueRepository;
    private final RewardService rewardService;
    private final RefundCalculatorService refundCalculatorService;

    /**
     * Charges the caller for their currently held slot, applying wallet
     * balance first. Always returns normally (HTTP 200 either way) — a
     * declined payment is a business outcome, not an error.
     */
    @Transactional
    public CheckoutResponse pay(Long userId, Long slotId, PaymentMethod method, BigDecimal applyWalletAmount,
            boolean simulateFailure) {
        Booking booking = bookingService.createPendingBooking(userId, slotId);

        BigDecimal netAmount = booking.getNetAmount();
        BigDecimal requestedWallet = applyWalletAmount != null ? applyWalletAmount : BigDecimal.ZERO;
        BigDecimal walletBalance = rewardService.getWalletBalance(userId);
        BigDecimal walletApplied = requestedWallet.min(walletBalance).min(netAmount);
        BigDecimal gatewayAmount = netAmount.subtract(walletApplied);

        // A $0 gateway charge (wallet fully covers the price) can't be "declined" —
        // there's nothing left to charge, and `payments.amount` must be > 0.
        boolean declined = simulateFailure && gatewayAmount.signum() > 0;

        Payment gatewayPayment = null;
        if (gatewayAmount.signum() > 0) {
            gatewayPayment = Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(booking.getId())
                    .type(PaymentType.BOOKING)
                    .amount(gatewayAmount)
                    .method(method)
                    .provider("mock-" + method.name().toLowerCase())
                    .status(declined ? PaymentStatus.FAILED : PaymentStatus.SUCCESS)
                    .failureReason(declined ? "Simulated payment failure" : null)
                    .paidAt(declined ? null : OffsetDateTime.now())
                    .build();
            gatewayPayment = paymentRepository.save(gatewayPayment);
        }

        if (declined) {
            return CheckoutResponse.builder()
                    .status("FAILED")
                    .payment(toResponse(gatewayPayment))
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .message("Payment declined — your slot is still held, you can try again.")
                    .build();
        }

        if (walletApplied.signum() > 0) {
            rewardService.applyWalletAtCheckout(userId, walletApplied, booking.getId());
        }
        bookingService.finalizeConfirmedBooking(booking);

        int pointsEarned = PointReason.BOOKING.defaultPoints();
        rewardService.awardBookingPoints(userId, booking.getId());
        Optional<PointLedgerEntry> offPeak = rewardService.awardOffPeakBonusIfApplicable(userId, booking.getId(),
                booking.getStartTime());
        if (offPeak.isPresent()) {
            pointsEarned += offPeak.get().getDelta();
        }

        return CheckoutResponse.builder()
                .status("SUCCESS")
                .payment(toResponse(gatewayPayment))
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .walletApplied(walletApplied)
                .newWalletBalance(rewardService.getWalletBalance(userId))
                .pointsEarned(pointsEarned)
                .message("Payment successful — your booking is confirmed.")
                .build();
    }

    /** A booking's payment history, most recent first — for the booking detail page. */
    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentsForBooking(Long userId, Long bookingId) {
        bookingService.getBooking(userId, bookingId); // ownership check; throws if not accessible
        return paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Read-only refund preview for the cancel confirmation screen. */
    @Transactional(readOnly = true)
    public RefundPreviewResponse previewRefund(Long userId, Long bookingId) {
        Booking booking = bookingService.getBooking(userId, bookingId);
        return computePreview(booking);
    }

    /**
     * Cancels a booking (via the existing, unmodified
     * {@link BookingService#cancelBooking}) and records a {@link PaymentType#REFUND}
     * payment for whatever percentage the venue's cancellation policy allows.
     */
    @Transactional
    public CancelRefundResponse cancelAndRefund(Long userId, Long bookingId) {
        Booking booking = bookingService.getBooking(userId, bookingId);
        RefundPreviewResponse preview = computePreview(booking);

        bookingService.cancelBooking(userId, bookingId);

        PaymentResponse refundResponse = null;
        if (preview.getRefundAmount().signum() > 0) {
            Payment original = paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                    .filter(p -> p.getType() == PaymentType.BOOKING && p.getStatus() == PaymentStatus.SUCCESS)
                    .findFirst()
                    .orElse(null);

            Payment refund = Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(bookingId)
                    .type(PaymentType.REFUND)
                    .amount(preview.getRefundAmount())
                    .method(original != null ? original.getMethod() : PaymentMethod.CASH)
                    .provider(original != null ? original.getProvider() : "mock-refund")
                    .status(PaymentStatus.SUCCESS)
                    .paidAt(OffsetDateTime.now())
                    .refundOfPaymentId(original != null ? original.getId() : null)
                    .build();
            refundResponse = toResponse(paymentRepository.save(refund));
        }

        return CancelRefundResponse.builder()
                .bookingId(bookingId)
                .bookingStatus("CANCELLED")
                .refundPercent(preview.getRefundPercent())
                .refundAmount(preview.getRefundAmount())
                .refundPayment(refundResponse)
                .build();
    }

    private RefundPreviewResponse computePreview(Booking booking) {
        Venue venue = venueRepository.findById(booking.getVenueId())
                .orElseThrow(() -> new IllegalArgumentException("Venue not found for this booking"));
        double hoursUntilStart = hoursUntilStart(booking);
        int percent = refundCalculatorService.calculateRefundPercent(venue.getCancelPolicy(), hoursUntilStart);

        // Full-payment-only this round (no deposit/split tracking yet), so the booking's
        // net amount stands in for "amount paid" once it's CONFIRMED.
        BigDecimal amountPaid = booking.getNetAmount();
        BigDecimal refundAmount = amountPaid
                .multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        return RefundPreviewResponse.builder()
                .cancelPolicy(venue.getCancelPolicy())
                .hoursUntilStart(hoursUntilStart)
                .refundPercent(percent)
                .refundAmount(refundAmount)
                .amountPaid(amountPaid)
                .build();
    }

    private double hoursUntilStart(Booking booking) {
        LocalDateTime slotStart = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        return Duration.between(LocalDateTime.now(), slotStart).toMinutes() / 60.0;
    }

    private PaymentResponse toResponse(Payment payment) {
        if (payment == null) {
            return null;
        }
        return PaymentResponse.builder()
                .id(payment.getId())
                .txnReference(payment.getTxnReference())
                .type(payment.getType())
                .amount(payment.getAmount())
                .method(payment.getMethod())
                .status(payment.getStatus())
                .failureReason(payment.getFailureReason())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }

    private String generateTxnReference() {
        for (int attempt = 0; attempt < TXN_REF_MAX_ATTEMPTS; attempt++) {
            String ref = "PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            if (!paymentRepository.existsByTxnReference(ref)) {
                return ref;
            }
        }
        throw new IllegalStateException("Could not generate a unique payment reference");
    }
}
