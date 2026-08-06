package com.turfchai.pricing.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PricingQuoteResponse {
    private float multiplier;
    private float baseRate;
    private float suggestedPrice;
    private FeatureBreakdown featureBreakdown;

    @Data
    @Builder
    public static class FeatureBreakdown {
        private float day;
        private float month;
        private float hour;
        private float weekend;
        private float publicHoliday;
        private float daysBeforeBooking;
        private float weatherCondition;
        private float occupancyRate;
        private float timeSlot;
    }
}
