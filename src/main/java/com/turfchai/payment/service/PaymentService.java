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
import com.turfchai.exception.PromotionRejectedException;
import com.turfchai.promotion.dto.AppliedDiscountResponse;
import com.turfchai.promotion.dto.ValidatePromoCodeRequest;
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
 * <p>
 * <b>No real payment provider is contacted anywhere in this class.</b> There
 * is no bKash/Nagad/card integration behind it: a charge writes a ledger row
 * and
 * is treated as taken. The product records what is owed and by which method,
 * and
 * the venue settles with the player directly — so no card data, PIN or token is
 * ever accepted, transmitted or stored.
 *
 * <p>
 * Payment gates booking confirmation:
 * {@link BookingService#createPendingBooking}
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
    private final com.turfchai.promotion.service.PromotionService promotionService;
    private final com.turfchai.service.NotificationService notificationService;
    private final com.turfchai.booking.service.BookingSplitService bookingSplitService;
    private final com.turfchai.service.OpenGameService openGameService;
    /** Refund tiers are time-based, so the clock is injectable for tests. */
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public PaymentService(PaymentRepository paymentRepository,
            BookingService bookingService,
            VenueRepository venueRepository,
            RewardService rewardService,
            RefundCalculatorService refundCalculatorService,
            com.turfchai.promotion.service.PromotionService promotionService,
            com.turfchai.service.NotificationService notificationService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.turfchai.booking.service.BookingSplitService bookingSplitService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.turfchai.service.OpenGameService openGameService) {
        this(paymentRepository, bookingService, venueRepository, rewardService,
                refundCalculatorService, promotionService, notificationService,
                bookingSplitService, openGameService, Clock.systemDefaultZone());
    }

    PaymentService(PaymentRepository paymentRepository,
            BookingService bookingService,
            VenueRepository venueRepository,
            RewardService rewardService,
            RefundCalculatorService refundCalculatorService,
            com.turfchai.promotion.service.PromotionService promotionService,
            com.turfchai.service.NotificationService notificationService,
            Clock clock) {
        this(paymentRepository, bookingService, venueRepository, rewardService,
                refundCalculatorService, promotionService, notificationService, null, null, clock);
    }

    PaymentService(PaymentRepository paymentRepository,
            BookingService bookingService,
            VenueRepository venueRepository,
            RewardService rewardService,
            RefundCalculatorService refundCalculatorService,
            com.turfchai.promotion.service.PromotionService promotionService,
            com.turfchai.service.NotificationService notificationService,
            com.turfchai.booking.service.BookingSplitService bookingSplitService,
            com.turfchai.service.OpenGameService openGameService,
            Clock clock) {
        this.paymentRepository = paymentRepository;
        this.bookingService = bookingService;
        this.venueRepository = venueRepository;
        this.rewardService = rewardService;
        this.refundCalculatorService = refundCalculatorService;
        this.promotionService = promotionService;
        this.notificationService = notificationService;
        this.bookingSplitService = bookingSplitService;
        this.openGameService = openGameService;
        this.clock = clock;
    }

    /**
     * Charges the caller for their currently held slot, applying wallet
     * balance first.
     */
    @Transactional
    public CheckoutResponse pay(Long userId, Long slotId, PaymentMethod method, BigDecimal applyWalletAmount) {
        return pay(userId, slotId, method, applyWalletAmount, null);
    }

    @Transactional
    public CheckoutResponse pay(Long userId, Long slotId, PaymentMethod method, BigDecimal applyWalletAmount,
            String promoCode) {
        com.turfchai.payment.dto.request.CheckoutRequest req = new com.turfchai.payment.dto.request.CheckoutRequest();
        req.setSlotId(slotId);
        req.setMethod(method);
        req.setApplyWalletAmount(applyWalletAmount);
        req.setPromoCode(promoCode);
        req.setBookingMode("FULL");
        return pay(userId, req);
    }

    @Transactional
    public CheckoutResponse pay(Long userId, com.turfchai.payment.dto.request.CheckoutRequest request) {
        try {
            return doPay(userId, request);
        } catch (com.turfchai.booking.exception.SlotUnavailableException e) {
            notificationService.sendDetached(userId, "PAYMENT_FAILED",
                    "Payment could not be completed",
                    "That slot was no longer yours to book when the payment went through, so nothing was charged.",
                    "/player/bookings");
            throw e;
        }
    }

    private CheckoutResponse doPay(Long userId, com.turfchai.payment.dto.request.CheckoutRequest request) {
        Long slotId = request.getSlotId();
        PaymentMethod method = request.getMethod();
        BigDecimal applyWalletAmount = request.getApplyWalletAmount();
        String promoCode = request.getPromoCode();
        String bookingMode = request.getBookingMode() != null ? request.getBookingMode().toUpperCase() : "FULL";

        Booking booking = bookingService.createPendingBooking(userId, slotId);

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new IllegalStateException("This booking has already been paid for");
        }

        // The discount is priced here, from the slot price the server holds
        BigDecimal discount = BigDecimal.ZERO;
        String appliedCode = null;
        if (promoCode != null && !promoCode.isBlank()) {
            AppliedDiscountResponse quote = promotionService.validateAndApply(new ValidatePromoCodeRequest(
                    promoCode.strip(), booking.getGrossAmount(), booking.getVenueId()));
            if (!quote.valid()) {
                throw new PromotionRejectedException(quote.message());
            }
            if (!promotionService.recordUsage(booking.getVenueId(), promoCode.strip())) {
                throw new PromotionRejectedException("This promo code has just been fully redeemed");
            }
            discount = quote.discountAmount();
            appliedCode = quote.code();
        }

        BigDecimal netAmount = booking.getGrossAmount().subtract(discount).max(BigDecimal.ZERO);
        booking.setDiscountAmount(discount);
        booking.setPromoCode(appliedCode);
        booking.setNetAmount(netAmount);

        // Determine host share due now
        BigDecimal amountDueFromHost = netAmount;
        int splitCount = 1;
        if ("SPLIT".equals(bookingMode)) {
            splitCount = request.getSplitPlayerCount() != null && request.getSplitPlayerCount() >= 2
                    ? request.getSplitPlayerCount()
                    : 2;
            amountDueFromHost = netAmount.divide(BigDecimal.valueOf(splitCount), 2, RoundingMode.HALF_UP);
        } else if ("OPEN_GAME".equals(bookingMode)) {
            int capacity = request.getOpenGameCapacity() != null && request.getOpenGameCapacity() >= 2
                    ? request.getOpenGameCapacity()
                    : 10;
            if (request.getOpenGamePricePerPlayer() != null && request.getOpenGamePricePerPlayer().compareTo(BigDecimal.ZERO) >= 0) {
                amountDueFromHost = request.getOpenGamePricePerPlayer();
            } else {
                amountDueFromHost = netAmount.divide(BigDecimal.valueOf(capacity), 2, RoundingMode.HALF_UP);
            }
        }

        BigDecimal requestedWallet = applyWalletAmount != null ? applyWalletAmount : BigDecimal.ZERO;
        BigDecimal walletBalance = rewardService.getWalletBalance(userId);
        BigDecimal walletApplied = requestedWallet.min(walletBalance).min(amountDueFromHost).max(BigDecimal.ZERO);
        BigDecimal gatewayAmount = amountDueFromHost.subtract(walletApplied);

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

        // Handle Split setup
        if ("SPLIT".equals(bookingMode) && bookingSplitService != null) {
            bookingSplitService.enableSplit(booking.getId(),
                    new com.turfchai.booking.dto.request.BookingSplitRequest(splitCount),
                    userId, method);
        }

        // Handle Open Game setup
        if ("OPEN_GAME".equals(bookingMode) && openGameService != null) {
            int capacity = request.getOpenGameCapacity() != null && request.getOpenGameCapacity() >= 2 ? request.getOpenGameCapacity() : 10;
            int reserved = request.getOpenGameReservedSpots() != null && request.getOpenGameReservedSpots() >= 1 ? request.getOpenGameReservedSpots() : 1;
            com.turfchai.model.enums.SkillLevel skill = com.turfchai.model.enums.SkillLevel.ALL_LEVELS;
            if (request.getOpenGameSkillLevel() != null) {
                try {
                    skill = com.turfchai.model.enums.SkillLevel.valueOf(request.getOpenGameSkillLevel());
                } catch (Exception ignored) {}
            }
            String title = request.getOpenGameTitle() != null && !request.getOpenGameTitle().isBlank()
                    ? request.getOpenGameTitle().trim()
                    : "Match at " + booking.getVenueId();

            com.turfchai.dto.request.CreateOpenGameRequest ogReq = com.turfchai.dto.request.CreateOpenGameRequest.builder()
                    .bookingId(booking.getId())
                    .title(title)
                    .venueId(booking.getVenueId())
                    .pitchId(booking.getPitchId())
                    .gameDate(booking.getBookingDate())
                    .startTime(booking.getStartTime() != null ? booking.getStartTime() : java.time.LocalTime.of(18, 0))
                    .endTime(booking.getEndTime() != null ? booking.getEndTime() : java.time.LocalTime.of(19, 30))
                    .skillLevel(skill)
                    .capacity(capacity)
                    .reservedSpots(reserved)
                    .pricePerPlayer(amountDueFromHost)
                    .build();
            openGameService.createOpenGame(ogReq, userId);

            // If friend spots are reserved, initialize split tracking for them
            if (reserved > 1 && bookingSplitService != null) {
                bookingSplitService.enableSplit(booking.getId(),
                        new com.turfchai.booking.dto.request.BookingSplitRequest(reserved),
                        userId, method, amountDueFromHost.multiply(BigDecimal.valueOf(reserved)));
            }
        }

        int pointsEarned = 0;
        if (amountDueFromHost.signum() > 0) {
            pointsEarned = rewardService.awardBookingPoints(userId, booking.getId(), amountDueFromHost).getDelta();
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
                .promoCode(appliedCode)
                .discountApplied(discount)
                .newWalletBalance(rewardService.getWalletBalance(userId))
                .pointsEarned(pointsEarned)
                .message("Booking confirmed.")
                .build();
    }

    /**
     * A booking's payment history, most recent first — for the booking detail page.
     */
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
     * <p>
     * The refund is split by tender. The gateway can only be given back what
     * the gateway received, and wallet credit goes back to the wallet — refunding
     * the whole booking price as cash paid out money that was never collected and
     * left the player's credit gone as well.
     *
     * <p>
     * A booking with no successful payment (a PENDING checkout that never
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

        BigDecimal refundTotal = walletRefund.add(gatewayRefund);
        if (refundTotal.signum() > 0) {
            // Only when money actually moved. A 0% tier cancels the booking and
            // returns nothing, and saying "refund issued" there would be a lie.
            notificationService.sendOnce(booking.getUserId(), "REFUND_ISSUED",
                    "Refund issued · ৳" + refundTotal.stripTrailingZeros().toPlainString(),
                    "We refunded " + percent + "% for booking " + booking.getBookingCode()
                            + (walletRefund.signum() > 0 && gatewayRefund.signum() > 0
                                    ? " — ৳" + gatewayRefund.stripTrailingZeros().toPlainString()
                                            + " to your payment method and ৳"
                                            + walletRefund.stripTrailingZeros().toPlainString() + " to your wallet."
                                    : walletRefund.signum() > 0 ? " back to your wallet." : " to your payment method."),
                    "/player/bookings/" + bookingId);
        }

        return CancelRefundResponse.builder()
                .bookingId(bookingId)
                .bookingStatus("CANCELLED")
                .refundPercent(percent)
                .refundAmount(refundTotal)
                .refundPayment(refundResponse)
                .build();
    }

    /**
     * Money the gateway actually took for this booking.
     *
     * <p>
     * The wallet leg of a split payment is also stored as a BOOKING row so the
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
     * <p>
     * Uses the injected clock's zone rather than {@code LocalDateTime.now()}:
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
     * <p>
     * This used to be 8 hex characters — 32 bits — checked for existence before
     * insert. That is both small enough to collide in a busy ledger and racy, since
     * two concurrent checkouts could pass the check and then fight over the unique
     * constraint, failing a legitimate payment. A full UUID makes collision a
     * non-event, so no pre-check is needed.
     */
    private String generateTxnReference() {
        return "PAY-" + UUID.randomUUID().toString().toUpperCase();
    }
}
