package com.turfchai.dto.response;

import com.turfchai.model.Payout;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Admin settlement view of a payout. */
public record PayoutResponse(
        Long id,
        String payoutCode,
        Long ownerUserId,
        Long venueId,
        BigDecimal grossAmount,
        BigDecimal platformFee,
        BigDecimal netAmount,
        String currency,
        String status,
        Boolean anomalyFlag,
        String anomalyReason,
        LocalDate periodStart,
        LocalDate periodEnd,
        LocalDate scheduledDate,
        OffsetDateTime settledAt,
        Long settledBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static PayoutResponse from(Payout payout) {
        if (payout == null) {
            return null;
        }
        return new PayoutResponse(
                payout.getId(),
                payout.getPayoutCode(),
                payout.getOwnerUserId(),
                payout.getVenueId(),
                payout.getGrossAmount(),
                payout.getPlatformFee(),
                payout.getNetAmount(),
                payout.getCurrency(),
                payout.getStatus(),
                payout.getAnomalyFlag(),
                payout.getAnomalyReason(),
                payout.getPeriodStart(),
                payout.getPeriodEnd(),
                payout.getScheduledDate(),
                payout.getSettledAt(),
                payout.getSettledBy(),
                payout.getCreatedAt(),
                payout.getUpdatedAt());
    }
}
