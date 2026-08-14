package com.turfchai.venue.dto.owner;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/** Response for GET /api/v1/owner/venues/{id}/slot-price */
public record SlotPriceResponse(
        BigDecimal rate,
        int slotDurationMin,
        int bufferMin,
        String windowType,
        String sportSlug,
        LocalDate bookingDate,
        LocalTime startTime,
        LocalTime endTime,
        /** total = rate * numberOfSlots */
        BigDecimal totalPrice
) {}
