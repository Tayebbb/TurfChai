package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.service.BookingService;
import com.turfchai.payment.dto.response.CancelRefundResponse;
import com.turfchai.payment.dto.response.CheckoutResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private BookingService bookingService;
    @Mock
    private VenueRepository venueRepository;
    @Mock
    private RewardService rewardService;
    @Mock
    private RefundCalculatorService refundCalculatorService;

    /** Pinned so refund tiers and paidAt do not drift with the wall clock. */
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2025-06-01T09:00:00Z"), ZoneOffset.UTC);

    private PaymentService paymentService;

    private static final Long USER_ID = 42L;
    private static final Long SLOT_ID = 7L;
    private static final Long BOOKING_ID = 100L;

    private Booking pendingBooking;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(paymentRepository, bookingService, venueRepository,
                rewardService, refundCalculatorService, CLOCK);
        pendingBooking = booking(BookingStatus.PENDING, BigDecimal.valueOf(2000));
    }

    private static Booking booking(BookingStatus status, BigDecimal netAmount) {
        return Booking.builder()
                .id(BOOKING_ID)
                .bookingCode("TC-ABC123")
                .userId(USER_ID)
                .venueId(1L)
                .status(status)
                .bookingDate(LocalDate.now(CLOCK).plusDays(2))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 30))
                .grossAmount(netAmount)
                .netAmount(netAmount)
                .build();
    }

    /** A settled gateway charge sitting in the ledger for BOOKING_ID. */
    private static Payment gatewayCharge(BigDecimal amount) {
        return Payment.builder()
                .id(5L)
                .bookingId(BOOKING_ID)
                .userId(USER_ID)
                .type(PaymentType.BOOKING)
                .status(PaymentStatus.SUCCESS)
                .amount(amount)
                .method(PaymentMethod.BKASH)
                .provider("turfchai-sim")
                .build();
    }

    private static PointLedgerEntry pointsAwarded(int delta) {
        return PointLedgerEntry.builder().delta(delta).build();
    }

    @Test
    @DisplayName("pay() succeeds: charges the gateway, confirms the booking, awards points")
    void pay_success_chargesGatewayAndConfirmsBooking() {
        when(bookingService.createPendingBooking(USER_ID, SLOT_ID)).thenReturn(pendingBooking);
        when(rewardService.getWalletBalance(USER_ID)).thenReturn(BigDecimal.ZERO);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });
        when(rewardService.awardBookingPoints(anyLong(), anyLong(), any(BigDecimal.class)))
                .thenReturn(pointsAwarded(20));
        when(rewardService.awardOffPeakBonusIfApplicable(anyLong(), anyLong(), any())).thenReturn(Optional.empty());

        CheckoutResponse response = paymentService.pay(USER_ID, SLOT_ID, PaymentMethod.BKASH, null);

        assertEquals("SUCCESS", response.getStatus());
        assertEquals(BOOKING_ID, response.getBookingId());
        assertNotNull(response.getPayment());
        assertEquals(PaymentStatus.SUCCESS, response.getPayment().getStatus());
        assertEquals(BigDecimal.valueOf(2000), response.getPayment().getAmount());

        verify(bookingService).finalizeConfirmedBooking(pendingBooking);
        verify(rewardService).awardBookingPoints(USER_ID, BOOKING_ID, BigDecimal.valueOf(2000));
        verify(rewardService, never()).applyWalletAtCheckout(any(), any(), any());
        // No wallet was used, so there is exactly one payment row.
        verify(paymentRepository, times(1)).save(any(Payment.class));
    }

    @Test
    @DisplayName("pay() applies wallet balance first, only charging the gateway for the remainder")
    void pay_appliesWalletBeforeGateway() {
        when(bookingService.createPendingBooking(USER_ID, SLOT_ID)).thenReturn(pendingBooking);
        when(rewardService.getWalletBalance(USER_ID)).thenReturn(BigDecimal.valueOf(500));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });
        when(rewardService.awardBookingPoints(anyLong(), anyLong(), any(BigDecimal.class)))
                .thenReturn(pointsAwarded(15));
        when(rewardService.awardOffPeakBonusIfApplicable(anyLong(), anyLong(), any())).thenReturn(Optional.empty());

        CheckoutResponse response = paymentService.pay(USER_ID, SLOT_ID, PaymentMethod.NAGAD, BigDecimal.valueOf(500));

        assertEquals("SUCCESS", response.getStatus());
        assertEquals(BigDecimal.valueOf(500), response.getWalletApplied());
        assertEquals(BigDecimal.valueOf(1500), response.getPayment().getAmount());
        verify(rewardService).applyWalletAtCheckout(USER_ID, BigDecimal.valueOf(500), BOOKING_ID);

        // The wallet leg is ledgered too, otherwise the booking looks underpaid.
        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository, times(2)).save(saved.capture());
        Payment walletLeg = saved.getAllValues().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsRewardWalletPayment()))
                .findFirst()
                .orElseThrow();
        assertEquals(BigDecimal.valueOf(500), walletLeg.getAmount());
        assertEquals(BigDecimal.valueOf(2000),
                saved.getAllValues().stream()
                        .map(Payment::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    @DisplayName("pay() caps the requested wallet amount at the caller's actual balance")
    void pay_capsWalletAtActualBalance() {
        when(bookingService.createPendingBooking(USER_ID, SLOT_ID)).thenReturn(pendingBooking);
        when(rewardService.getWalletBalance(USER_ID)).thenReturn(BigDecimal.valueOf(100));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });
        when(rewardService.awardBookingPoints(anyLong(), anyLong(), any(BigDecimal.class)))
                .thenReturn(pointsAwarded(19));
        when(rewardService.awardOffPeakBonusIfApplicable(anyLong(), anyLong(), any())).thenReturn(Optional.empty());

        // Caller asks to apply 2000, but only has 100 in the wallet.
        CheckoutResponse response = paymentService.pay(USER_ID, SLOT_ID, PaymentMethod.CARD, BigDecimal.valueOf(2000));

        assertEquals(BigDecimal.valueOf(100), response.getWalletApplied());
        assertEquals(BigDecimal.valueOf(1900), response.getPayment().getAmount());
    }

    @Test
    @DisplayName("previewRefund() applies the venue's cancellation policy to the time until the slot starts")
    void previewRefund_usesVenuePolicy() {
        Booking confirmed = booking(BookingStatus.CONFIRMED, BigDecimal.valueOf(2000));
        when(bookingService.getBooking(USER_ID, BOOKING_ID)).thenReturn(confirmed);
        when(venueRepository.findById(1L)).thenReturn(Optional.of(
                Venue.builder().id(1L).cancelPolicy("FREE_24H_50_6H").build()));
        when(refundCalculatorService.calculateRefundPercent(eqPolicy("FREE_24H_50_6H"), anyDoubleArg())).thenReturn(100);
        when(paymentRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID))
                .thenReturn(List.of(gatewayCharge(BigDecimal.valueOf(2000))));
        when(rewardService.walletSpentOnBooking(BOOKING_ID)).thenReturn(BigDecimal.ZERO);

        RefundPreviewResponse preview = paymentService.previewRefund(USER_ID, BOOKING_ID);

        assertEquals(100, preview.getRefundPercent());
        assertEquals(BigDecimal.valueOf(2000).setScale(2), preview.getRefundAmount());
    }

    @Test
    @DisplayName("cancelAndRefund() refunds what the gateway actually took, at the policy percentage")
    void cancelAndRefund_recordsRefundPayment() {
        Booking confirmed = booking(BookingStatus.CONFIRMED, BigDecimal.valueOf(2000));
        when(bookingService.getBooking(USER_ID, BOOKING_ID)).thenReturn(confirmed);
        when(venueRepository.findById(1L)).thenReturn(Optional.of(
                Venue.builder().id(1L).cancelPolicy("FREE_24H_50_6H").build()));
        when(refundCalculatorService.calculateRefundPercent(eqPolicy("FREE_24H_50_6H"), anyDoubleArg())).thenReturn(50);
        when(paymentRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID))
                .thenReturn(List.of(gatewayCharge(BigDecimal.valueOf(2000))));
        when(rewardService.walletSpentOnBooking(BOOKING_ID)).thenReturn(BigDecimal.ZERO);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(9L);
            return p;
        });

        CancelRefundResponse response = paymentService.cancelAndRefund(USER_ID, BOOKING_ID);

        assertEquals(50, response.getRefundPercent());
        assertEquals(BigDecimal.valueOf(1000).setScale(2), response.getRefundAmount());
        assertNotNull(response.getRefundPayment());

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        assertEquals(PaymentType.REFUND, captor.getValue().getType());
        assertEquals(BigDecimal.valueOf(1000).setScale(2), captor.getValue().getAmount());
        verify(bookingService).cancelBooking(USER_ID, BOOKING_ID);
        verify(rewardService).reverseBookingPoints(USER_ID, BOOKING_ID);
    }

    @Test
    @DisplayName("cancelAndRefund() splits the refund between the gateway and the wallet")
    void cancelAndRefund_splitsRefundByTender() {
        Booking confirmed = booking(BookingStatus.CONFIRMED, BigDecimal.valueOf(2000));
        when(bookingService.getBooking(USER_ID, BOOKING_ID)).thenReturn(confirmed);
        when(venueRepository.findById(1L)).thenReturn(Optional.of(
                Venue.builder().id(1L).cancelPolicy("FREE_24H_50_6H").build()));
        when(refundCalculatorService.calculateRefundPercent(eqPolicy("FREE_24H_50_6H"), anyDoubleArg())).thenReturn(100);
        // 1500 came from the gateway, 500 from wallet credit.
        when(paymentRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID))
                .thenReturn(List.of(gatewayCharge(BigDecimal.valueOf(1500))));
        when(rewardService.walletSpentOnBooking(BOOKING_ID)).thenReturn(BigDecimal.valueOf(500));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        CancelRefundResponse response = paymentService.cancelAndRefund(USER_ID, BOOKING_ID);

        assertEquals(BigDecimal.valueOf(2000).setScale(2), response.getRefundAmount());
        assertEquals(BigDecimal.valueOf(1500).setScale(2), response.getRefundPayment().getAmount());
        verify(rewardService).refundToWallet(USER_ID, BigDecimal.valueOf(500).setScale(2), BOOKING_ID);
    }

    @Test
    @DisplayName("cancelAndRefund() refunds nothing for a booking that was never paid")
    void cancelAndRefund_paysNothingBackWhenNothingWasTaken() {
        Booking pending = booking(BookingStatus.PENDING, BigDecimal.valueOf(2000));
        when(bookingService.getBooking(USER_ID, BOOKING_ID)).thenReturn(pending);
        when(venueRepository.findById(1L)).thenReturn(Optional.of(
                Venue.builder().id(1L).cancelPolicy("FREE_24H_50_6H").build()));
        when(refundCalculatorService.calculateRefundPercent(eqPolicy("FREE_24H_50_6H"), anyDoubleArg())).thenReturn(100);
        when(paymentRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID)).thenReturn(List.of());
        when(rewardService.walletSpentOnBooking(BOOKING_ID)).thenReturn(BigDecimal.ZERO);

        CancelRefundResponse response = paymentService.cancelAndRefund(USER_ID, BOOKING_ID);

        assertEquals(0, response.getRefundAmount().signum());
        assertNull(response.getRefundPayment());
        verify(paymentRepository, never()).save(any());
        verify(rewardService, never()).refundToWallet(any(), any(), any());
    }

    @Test
    @DisplayName("cancelAndRefund() records no refund payment when the policy allows 0%")
    void cancelAndRefund_noRefund_whenPolicyDisallows() {
        Booking confirmed = booking(BookingStatus.CONFIRMED, BigDecimal.valueOf(2000));
        when(bookingService.getBooking(USER_ID, BOOKING_ID)).thenReturn(confirmed);
        when(venueRepository.findById(1L)).thenReturn(Optional.of(
                Venue.builder().id(1L).cancelPolicy("STRICT_NO_REFUND").build()));
        when(refundCalculatorService.calculateRefundPercent(eqPolicy("STRICT_NO_REFUND"), anyDoubleArg())).thenReturn(0);
        when(paymentRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID))
                .thenReturn(List.of(gatewayCharge(BigDecimal.valueOf(2000))));
        when(rewardService.walletSpentOnBooking(BOOKING_ID)).thenReturn(BigDecimal.ZERO);

        CancelRefundResponse response = paymentService.cancelAndRefund(USER_ID, BOOKING_ID);

        assertTrue(response.getRefundAmount().signum() == 0);
        assertNull(response.getRefundPayment());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    @DisplayName("pay() refuses to charge a booking that is already confirmed")
    void pay_refusesToChargeTwice() {
        when(bookingService.createPendingBooking(USER_ID, SLOT_ID))
                .thenReturn(booking(BookingStatus.CONFIRMED, BigDecimal.valueOf(2000)));

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> paymentService.pay(USER_ID, SLOT_ID, PaymentMethod.BKASH, null));

        verify(paymentRepository, never()).save(any());
        verify(bookingService, never()).finalizeConfirmedBooking(any());
    }

    // Small readability helpers over raw Mockito matchers for the two-arg calculator call.
    private static String eqPolicy(String policy) {
        return org.mockito.ArgumentMatchers.eq(policy);
    }

    private static double anyDoubleArg() {
        return org.mockito.ArgumentMatchers.anyDouble();
    }
}
