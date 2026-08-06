package com.turfchai.pricing.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PricingQuoteRequest {
    private Long venueId;
    /** Optional: prices the base rate of this sport, e.g. "football". */
    private String sportSlug;
    private LocalDateTime bookingDateTime;
    private int daysBeforeBooking;
    private float occupancyRate;
}
