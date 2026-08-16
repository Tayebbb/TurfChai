package com.turfchai.pricing.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PricingQuoteRequest {

    @NotNull(message = "venueId is required")
    private Long venueId;

    /** Optional: prices the base rate of this sport, e.g. "football". */
    private String sportSlug;

    @NotNull(message = "bookingDateTime is required (ISO-8601, e.g. 2026-08-20T19:00:00)")
    private LocalDateTime bookingDateTime;

    @PositiveOrZero(message = "daysBeforeBooking cannot be negative")
    private int daysBeforeBooking;

    /**
     * Expected occupancy as a fraction, 0.0–1.0. The range is checked in the
     * service because Bean Validation's numeric constraints do not support
     * {@code float}.
     */
    private float occupancyRate;
}
