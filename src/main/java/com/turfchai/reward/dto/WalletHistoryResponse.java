package com.turfchai.reward.dto;

import com.turfchai.reward.entity.WalletTransaction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The player's wallet: current balance plus the ledger behind it.
 *
 * <p>
 * The balance is the sum of the deltas rather than a stored column, so it
 * always agrees with the entries shown below it.
 */
public record WalletHistoryResponse(
        BigDecimal balance,
        List<Entry> entries) {

    public record Entry(
            Long id,
            BigDecimal delta,
            String reason,
            String label,
            BigDecimal balanceAfter,
            Long bookingId,
            OffsetDateTime createdAt) {

        public static Entry from(WalletTransaction tx) {
            String reason = tx.getReason() != null ? tx.getReason().name() : "ADJUSTMENT";
            return new Entry(
                    tx.getId(),
                    tx.getDelta(),
                    reason,
                    labelFor(reason, tx.getDelta()),
                    tx.getBalanceAfter(),
                    tx.getBookingId(),
                    tx.getCreatedAt());
        }

        private static String labelFor(String reason, BigDecimal delta) {
            boolean credit = delta != null && delta.signum() >= 0;
            return switch (reason) {
                case "REWARD_CREDIT" -> "Reward credit";
                case "BOOKING_PAYMENT" -> "Spent on a booking";
                case "REFUND" -> "Booking refund";
                default -> credit ? "Credit" : "Debit";
            };
        }
    }
}
