package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolArgs;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.exception.BookingNotFoundException;
import com.turfchai.payment.dto.response.PaymentResponse;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.payment.service.PaymentService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The real payment ledger for one of the caller's bookings.
 *
 * <p>
 * Read-only, and it says out loud what the ledger means: a {@code payments}
 * row records what is <em>owed</em>, because TurfChai settles at the venue.
 * Reporting it as "paid" is the wording bug this platform has already fixed
 * twice on the booking screens.
 */
@Component
public class PaymentStatusTool implements Tool {

    private final PaymentService paymentService;
    private final BookingRepository bookingRepository;

    public PaymentStatusTool(PaymentService paymentService, BookingRepository bookingRepository) {
        this.paymentService = paymentService;
        this.bookingRepository = bookingRepository;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "get_payment_status",
                "Look up the real payment ledger for one of the signed-in user's bookings by booking code: "
                        + "every recorded leg, what is still due, and what has been refunded. "
                        + "TurfChai does not take payment online, so a recorded amount is what the user owes the venue.",
                List.of(ToolParam.required("bookingCode", "string", "Booking code, e.g. TC-A1B2C3")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        if (!context.isAuthenticated()) {
            return ToolResult.fail("The user is not signed in, so their payments cannot be read. "
                    + "Ask them to sign in at /auth.");
        }
        String code = ToolArgs.string(arguments, "bookingCode");
        if (code == null) {
            return ToolResult.fail("Missing required argument: bookingCode");
        }

        Optional<Booking> found = bookingRepository.findByBookingCode(code);
        if (found.isEmpty()) {
            return ToolResult.fail("No booking found with code " + code);
        }

        List<PaymentResponse> payments;
        try {
            // Performs the ownership check itself and throws when the booking
            // is not the caller's, so a code guessed from elsewhere reveals nothing.
            payments = paymentService.getPaymentsForBooking(context.authenticatedUserId(), found.get().getId());
        } catch (BookingNotFoundException e) {
            return ToolResult.fail("No booking found with code " + code);
        }

        BigDecimal recorded = sum(payments, p -> p.getStatus() == PaymentStatus.SUCCESS
                && p.getType() != PaymentType.REFUND);
        BigDecimal refunded = sum(payments, p -> p.getType() == PaymentType.REFUND
                || p.getStatus() == PaymentStatus.REFUNDED);

        Booking booking = found.get();
        BigDecimal price = booking.getGrossAmount() == null ? BigDecimal.ZERO : booking.getGrossAmount();

        Map<String, Object> body = ToolArgs.row();
        body.put("bookingCode", code);
        ToolArgs.put(body, "bookingStatus", booking.getStatus());
        body.put("slotPriceBdt", price);
        body.put("recordedBdt", recorded);
        body.put("refundedBdt", refunded);
        body.put("stillDueBdt", price.subtract(recorded).max(BigDecimal.ZERO));
        body.put("settlement", "Payable to the venue — TurfChai does not collect payment online.");
        body.put("legs", payments.stream().map(PaymentStatusTool::toRow).toList());
        if (payments.isEmpty()) {
            body.put("note", "No payment has been recorded against this booking yet.");
        }
        return ToolResult.ok(body);
    }

    private static Map<String, Object> toRow(PaymentResponse payment) {
        Map<String, Object> row = ToolArgs.row();
        ToolArgs.put(row, "reference", payment.getTxnReference());
        ToolArgs.put(row, "type", payment.getType());
        ToolArgs.put(row, "method", payment.getMethod());
        ToolArgs.put(row, "status", payment.getStatus());
        ToolArgs.put(row, "amountBdt", payment.getAmount());
        ToolArgs.put(row, "fromWallet", payment.getFromWallet());
        ToolArgs.put(row, "recordedAt", payment.getPaidAt());
        ToolArgs.put(row, "failureReason", payment.getFailureReason());
        return row;
    }

    private static BigDecimal sum(List<PaymentResponse> payments,
            java.util.function.Predicate<PaymentResponse> filter) {
        return payments.stream()
                .filter(filter)
                .map(PaymentResponse::getAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
