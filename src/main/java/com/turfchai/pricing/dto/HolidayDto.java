package com.turfchai.pricing.dto;

import com.turfchai.pricing.entity.Holiday;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Request and response shapes for the admin holiday calendar. */
public final class HolidayDto {

    private HolidayDto() {
    }

    /**
     * Binding the {@code Holiday} entity straight to the request body let a
     * caller set {@code createdAt} and {@code isManualOverride} directly. Only
     * the two fields an admin actually supplies are accepted here.
     */
    public record CreateRequest(
            @NotNull(message = "holidayDate is required") LocalDate holidayDate,
            @NotBlank(message = "description is required") @Size(max = 255) String description) {
    }

    public record UpdateRequest(
            @NotBlank(message = "description is required") @Size(max = 255) String description) {
    }

    public record Response(
            LocalDate holidayDate,
            String description,
            boolean manualOverride,
            OffsetDateTime createdAt) {

        public static Response from(Holiday holiday) {
            if (holiday == null) {
                return null;
            }
            return new Response(
                    holiday.getHolidayDate(),
                    holiday.getDescription(),
                    holiday.isManualOverride(),
                    holiday.getCreatedAt());
        }
    }
}
