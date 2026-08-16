package com.turfchai.booking.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {

    @Schema(description = "Booking ID", example = "12")
    private Long id;

    @Schema(description = "Generated booking code", example = "TC-A1B2C3")
    private String bookingCode;

    @Schema(description = "ID of the booked slot", example = "1")
    private Long slotId;

    @Schema(description = "ID of the user who owns the booking", example = "5")
    private Long userId;

    @Schema(description = "Current booking status", example = "CONFIRMED")
    private String status;

    @Schema(description = "Venue the slot belongs to", example = "4")
    private Long venueId;

    @Schema(description = "Venue name", example = "Kick Off Arena")
    private String venueName;

    @Schema(description = "Venue slug for deep links", example = "kick-off-arena")
    private String venueSlug;

    @Schema(description = "Venue area", example = "Dhanmondi")
    private String venueArea;

    @Schema(description = "Venue street address, for directions", example = "Road 27, Dhanmondi")
    private String venueAddress;

    @Schema(description = "Venue latitude, for directions", example = "23.7461")
    private BigDecimal venueLat;

    @Schema(description = "Venue longitude, for directions", example = "90.3742")
    private BigDecimal venueLng;

    @Schema(description = "Venue phone, for the contact action", example = "+8801700000000")
    private String venueContactPhone;

    @Schema(description = "Pitch booked", example = "7")
    private Long pitchId;

    @Schema(description = "Pitch name", example = "Pitch 2")
    private String pitchName;

    @Schema(description = "Date played", example = "2026-08-08")
    private LocalDate bookingDate;

    @Schema(description = "Slot start", example = "19:30")
    private LocalTime startTime;

    @Schema(description = "Slot end", example = "21:00")
    private LocalTime endTime;

    @Schema(description = "Amount payable for the slot", example = "2500.00")
    private BigDecimal amount;

    @Schema(description = "Net amount for this booking", example = "2500.00")
    private BigDecimal netAmount;

    @Schema(description = "Promo code redeemed for this booking, if any", example = "RAMADAN20")
    private String promoCode;

    @Schema(description = "Discount the promo code was worth", example = "500.00")
    private BigDecimal discountAmount;

    @Schema(description = "When the player checked in at the gate")
    private OffsetDateTime checkedInAt;

    @Schema(description = "When the booking was created", example = "2026-08-06T18:00:00+06:00")
    private OffsetDateTime createdAt;

    @Schema(description = "When the booking was last updated", example = "2026-08-06T18:05:00+06:00")
    private OffsetDateTime updatedAt;
}
