package com.turfchai.booking.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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

    @Schema(description = "When the booking was created", example = "2026-08-06T18:00:00+06:00")
    private OffsetDateTime createdAt;

    @Schema(description = "When the booking was last updated", example = "2026-08-06T18:05:00+06:00")
    private OffsetDateTime updatedAt;
}
