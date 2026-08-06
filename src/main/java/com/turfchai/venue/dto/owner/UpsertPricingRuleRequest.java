package com.turfchai.venue.dto.owner;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * Payload for POST /api/v1/owner/venues/{id}/pricing-rules.
 * Creates or replaces a rule for the given (sport, windowType) combination.
 */
public record UpsertPricingRuleRequest(

        /** sport slug, e.g. "football" */
        @NotBlank
        String sportSlug,

        /** 'OFF_PEAK' | 'PEAK' | 'FULL_DAY' */
        @NotNull
        @Pattern(regexp = "OFF_PEAK|PEAK|FULL_DAY")
        String windowType,

        /** Slot rate in BDT */
        @NotNull @DecimalMin("0")
        BigDecimal rate,

        /** One of: 30, 40, 60, 90, 120 */
        @NotNull
        Integer slotDurationMin,

        /** Buffer between slots in minutes (5, 10, or 15) */
        Integer bufferMin,

        @NotNull
        LocalTime windowStart,

        @NotNull
        LocalTime windowEnd,

        /**
         * ISO day numbers 1=Mon … 7=Sun; null means every day.
         * e.g. [1,2,3,4,5] for weekdays only.
         */
        List<Integer> daysOfWeek
) {}
