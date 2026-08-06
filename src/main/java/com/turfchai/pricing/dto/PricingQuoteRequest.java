package com.turfchai.pricing.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PricingQuoteRequest {
    private Long venueId;
    private LocalDateTime bookingDateTime;
    private int daysBeforeBooking;
    private float occupancyRate;
}
