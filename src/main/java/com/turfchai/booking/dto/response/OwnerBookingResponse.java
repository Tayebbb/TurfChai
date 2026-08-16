package com.turfchai.booking.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * The owner console's view of a booking.
 *
 * <p>Split out of {@link BookingResponse} because the two audiences need
 * different things: a player must never receive the customer's name and phone,
 * and previously every player-facing booking carried ten owner-only keys as
 * nulls, which made the contract impossible to read and impossible to type.
 */
@Data
@Builder
public class OwnerBookingResponse {

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

    @Schema(description = "Customer display name", example = "Rafi Ahmed")
    private String customer;

    @Schema(description = "Customer secondary line, normally the phone number")
    private String sub;

    @Schema(description = "Whether the secondary line should render in the numeric style")
    private boolean subNum;

    @Schema(description = "Pitch name", example = "Pitch 2")
    private String pitch;

    @Schema(description = "Slot start, preformatted for display", example = "7:00 PM")
    private String time;

    @Schema(description = "Booking origin badge: tone + text")
    private Map<String, String> source;

    @Schema(description = "Gross amount, preformatted", example = "৳2500")
    private String amountFormatted;

    @Schema(description = "Payment state badge: tone + text")
    private Map<String, String> payment;

    @Schema(description = "Row actions available for this booking's state")
    private List<Map<String, String>> actions;

    @Schema(description = "Whether the row should render de-emphasised (cancelled)")
    private boolean dim;
}
