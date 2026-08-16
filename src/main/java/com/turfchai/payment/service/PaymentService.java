package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
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
import com.turfchai.reward.service.RewardService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Simulated payment gateway + refund orchestration.
 *
 * <p><b>No real payment provider is contacted anywhere in this class.</b> There
 * is no bKash/Nagad/card integration behind it: a charge writes a ledger row and
 * is treated as taken. The product records what is owed and by which method, and
 * the venue settles with the player directly — so no card data, PIN or token is
 * ever accepted, transmitted or stored.
 *
 * <p>Payment gates booking confirmation: {@link BookingService#createPendingBooking}
 * creates a {@code PENDING} booking ahead of the charge, and only a
 * successful payment calls {@link BookingService#finalizeConfirmedBooking}.
 */
@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingService bookingService;
    private final VenueRepository venueRepository;
    private final RewardService rewardService;
    private final RefundCalculatorService refundCalculatorService;
    /** Refund tiers are time-based, so the clock is injectable for tests. */
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public PaymentService(PaymentRepository paymentRepository,
                          BookingService bookingService,
                          VenueRepository venueRepository,
                          RewardService rewardService,
                          RefundCalculatorService refundCalculatorService) {
        this(paymentRepository, bookingService, venueRepository, rewardService,
                refundCalculatorService, Clock.systemDefaultZone());
    }

    PaymentService(PaymentRepository paymentRepository,
                   BookingService bookingService,
                   VenueRepository venueRepository,
                   RewardService rewardService,
                   RefundCalculatorService refundCalculatorService,
                   Clock clock) {
        this.paymentRepository = paymentRepository;
        this.bookingService = bookingService;
        this.venueRepository = venueRepository;
        this.rewardService = rewardService;
        this.refundCalculatorService = refundCalculatorService;
        this.clock = clock;
    }

    /**
     * Charges the caller for their currently held slot, applying wallet
     * balance first.
     *
     * <p>Every tender that funds the booking gets its own {@code payments} row,
     * including wallet credit — otherwise a booking paid entirely from the wallet
     * was CONFIRMED with no payment record at all, and the ledger disagreed with
     * reality.
     */
    @Transactional
    public CheckoutResponse pay(Long userId, Long slotId, PaymentMethod method, BigDecimal applyWalletAmount) {
        Booking booking = bookingService.createPendingBooking(userId, slotId);

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new IllegalStateException("This booking has already been paid for");
        }

        BigDecimal netAmount = booking.getNetAmount();
        BigDecimal requestedWallet = applyWalletAmount != null ? applyWalletAmount : BigDecimal.ZERO;
        BigDecimal walletBalance = rewardService.getWalletBalance(userId);
        BigDecimal walletApplied = requestedWallet.min(walletBalance).min(netAmount).max(BigDecimal.ZERO);
        BigDecimal gatewayAmount = netAmount.subtract(walletApplied);

        Payment gatewayPayment = null;
        if (gatewayAmount.signum() > 0) {
            gatewayPayment = paymentRepository.save(Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(booking.getId())
                    .type(PaymentType.BOOKING)
                    .amount(gatewayAmount)
                    .method(method)
                    .provider("mock-" + method.name().toLowerCase())
                    .status(PaymentStatus.SUCCESS)
                    .paidAt(OffsetDateTime.now(clock))
                    .build());
        }

        if (walletApplied.signum() > 0) {
            rewardService.applyWalletAtCheckout(userId, walletApplied, booking.getId());
            paymentRepository.save(Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(booking.getId())
                    .type(PaymentType.BOOKING)
                    .amount(walletApplied)
                    .method(method)
                    .provider("turfchai-wallet")
                    .isRewardWalletPayment(true)
                    .status(PaymentStatus.SUCCESS)
                    .paidAt(OffsetDateTime.now(clock))
                    .build());
        }
        bookingService.finalizeConfirmedBooking(booking);

        int pointsEarned = 0;
        // A free slot earns no points; the reward service rejects a zero award,
        // which used to roll the whole paid checkout back.
        if (netAmount.signum() > 0) {
            pointsEarned = rewardService.awardBookingPoints(userId, booking.getId(), netAmount).getDelta();
            Optional<PointLedgerEntry> offPeak = rewardService.awardOffPeakBonusIfApplicable(userId, booking.getId(),
                    booking.getStartTime());
            if (offPeak.isPresent()) {
                pointsEarned += offPeak.get().getDelta();
            }
        }

        return CheckoutResponse.builder()
                .status("SUCCESS")
                .payment(toResponse(gatewayPayment))
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .walletApplied(walletApplied)
                .newWalletBalance(rewardService.getWalletBalance(userId))
                .pointsEarned(pointsEarned)
                .message("Booking confirmed.")
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
     * Cancels a booking and refunds what was actually taken for it.
     *
     * <p>The refund is split by tender. The gateway can only be given back what
     * the gateway received, and wallet credit goes back to the wallet — refunding
     * the whole booking price as cash paid out money that was never collected and
     * left the player's credit gone as well.
     *
     * <p>A booking with no successful payment (a PENDING checkout that never
     * completed) refunds nothing, because nothing was taken.
     */
    @Transactional
    public CancelRefundResponse cancelAndRefund(Long userId, Long bookingId) {
        Booking booking = bookingService.getBooking(userId, bookingId);
        RefundPreviewResponse preview = computePreview(booking);

        BigDecimal gatewayPaid = gatewayPaidFor(bookingId);
        BigDecimal walletPaid = rewardService.walletSpentOnBooking(bookingId);
        BigDecimal alreadyRefunded = alreadyRefundedFor(bookingId);

        // cancelBooking rejects an already-cancelled booking, which is what stops
        // a second refund; the check above is the belt to that pair of braces.
        bookingService.cancelBooking(userId, bookingId);
        rewardService.reverseBookingPoints(userId, bookingId);

        int percent = preview.getRefundPercent();
        BigDecimal walletRefund = percentOf(walletPaid, percent);
        BigDecimal gatewayRefund = percentOf(gatewayPaid, percent);

        PaymentResponse refundResponse = null;
        if (gatewayRefund.signum() > 0 && alreadyRefunded.signum() == 0) {
            // Must be the gateway charge, not the wallet leg. The ledger is ordered
            // newest-first and the wallet leg is written last, so taking the first
            // match refunded against the wrong row and left the real charge
            // still reading as a completed sale.
            Payment original = paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                    .filter(p -> p.getType() == PaymentType.BOOKING
                            && p.getStatus() == PaymentStatus.SUCCESS
                            && !Boolean.TRUE.equals(p.getIsRewardWalletPayment()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "Cannot refund a booking with no successful payment"));

            Payment refund = Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(bookingId)
                    .type(PaymentType.REFUND)
                    .amount(gatewayRefund)
                    .method(original.getMethod())
                    .provider(original.getProvider())
                    .status(PaymentStatus.SUCCESS)
                    .paidAt(OffsetDateTime.now(clock))
                    .refundOfPaymentId(original.getId())
                    .build();
            refundResponse = toResponse(paymentRepository.save(refund));

            // A fully refunded charge is no longer a completed sale.
            if (gatewayRefund.compareTo(original.getAmount()) >= 0) {
                original.setStatus(PaymentStatus.REFUNDED);
                paymentRepository.save(original);
            }
        }

        if (walletRefund.signum() > 0 && alreadyRefunded.signum() == 0) {
            rewardService.refundToWallet(userId, walletRefund, bookingId);
            // Ledger the wallet leg too, so the booking's payment history adds up
            // on its own. Without this the ledger showed a smaller refund than
            // the player actually received.
            Payment walletLeg = paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                    .filter(p -> p.getType() == PaymentType.BOOKING
                            && Boolean.TRUE.equals(p.getIsRewardWalletPayment()))
                    .findFirst()
                    .orElse(null);
            paymentRepository.save(Payment.builder()
                    .txnReference(generateTxnReference())
                    .userId(userId)
                    .bookingId(bookingId)
                    .type(PaymentType.REFUND)
                    .amount(walletRefund)
                    .method(walletLeg != null ? walletLeg.getMethod() : null)
                    .provider("turfchai-wallet")
                    .isRewardWalletPayment(true)
                    .status(PaymentStatus.SUCCESS)
                    .paidAt(OffsetDateTime.now(clock))
                    .refundOfPaymentId(walletLeg != null ? walletLeg.getId() : null)
                    .build());
            if (walletLeg != null && walletRefund.compareTo(walletLeg.getAmount()) >= 0) {
                walletLeg.setStatus(PaymentStatus.REFUNDED);
                paymentRepository.save(walletLeg);
            }
        }

        return CancelRefundResponse.builder()
                .bookingId(bookingId)
                .bookingStatus("CANCELLED")
                .refundPercent(percent)
                .refundAmount(walletRefund.add(gatewayRefund))
                .refundPayment(refundResponse)
                .build();
    }

    /**
     * Money the gateway actually took for this booking.
     *
     * <p>The wallet leg of a split payment is also stored as a BOOKING row so the
     * ledger reconciles against the booking total, but it is not gateway money and
     * must never be refunded as cash — it is returned to the wallet instead.
     */
    private BigDecimal gatewayPaidFor(Long bookingId) {
        return paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                .filter(p -> p.getType() == PaymentType.BOOKING
                        && !Boolean.TRUE.equals(p.getIsRewardWalletPayment())
                        && (p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.REFUNDED))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal alreadyRefundedFor(Long bookingId) {
        return paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId).stream()
                .filter(p -> p.getType() == PaymentType.REFUND && p.getStatus() == PaymentStatus.SUCCESS)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal percentOf(BigDecimal amount, int percent) {
        if (amount == null || amount.signum() <= 0 || percent <= 0) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private RefundPreviewResponse computePreview(Booking booking) {
        // The policy the player agreed to at checkout, not whatever the venue has
        // set today. Reading it live let an owner tighten their cancellation terms
        // after the fact and keep money the player was owed.
        String policy = booking.getCancelPolicySnapshot();
        if (policy == null) {
            policy = venueRepository.findById(booking.getVenueId())
                    .map(Venue::getCancelPolicy)
                    .orElseThrow(() -> new IllegalArgumentException("Venue not found for this booking"));
        }
        double hoursUntilStart = hoursUntilStart(booking);
        int percent = refundCalculatorService.calculateRefundPercent(policy, hoursUntilStart);

        // What the player is owed is what they actually handed over, by tender —
        // never the booking price, which a PENDING or wallet-funded booking never
        // charged in full.
        BigDecimal amountPaid = gatewayPaidFor(booking.getId())
                .add(rewardService.walletSpentOnBooking(booking.getId()));
        BigDecimal refundAmount = percentOf(amountPaid, percent);

        return RefundPreviewResponse.builder()
                .cancelPolicy(policy)
                .hoursUntilStart(hoursUntilStart)
                .refundPercent(percent)
                .refundAmount(refundAmount)
                .amountPaid(amountPaid)
                .build();
    }

    /**
     * Hours between now and kick-off.
     *
     * <p>Uses the injected clock's zone rather than {@code LocalDateTime.now()}:
     * slot times are local wall-clock, timestamps are stored in UTC, and taking
     * the JVM default silently shifted every refund tier by the zone offset.
     */
    private double hoursUntilStart(Booking booking) {
        if (booking.getBookingDate() == null || booking.getStartTime() == null) {
            return 0d;
        }
        LocalDateTime slotStart = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        return Duration.between(LocalDateTime.now(clock), slotStart).toMinutes() / 60.0;
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
                .fromWallet(Boolean.TRUE.equals(payment.getIsRewardWalletPayment()))
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }

    /**
     * A unique reference for a payment row.
     *
     * <p>This used to be 8 hex characters — 32 bits — checked for existence before
     * insert. That is both small enough to collide in a busy ledger and racy, since
     * two concurrent checkouts could pass the check and then fight over the unique
     * constraint, failing a legitimate payment. A full UUID makes collision a
     * non-event, so no pre-check is needed.
     */
    private String generateTxnReference() {
        return "PAY-" + UUID.randomUUID().toString().toUpperCase();
    }
}
