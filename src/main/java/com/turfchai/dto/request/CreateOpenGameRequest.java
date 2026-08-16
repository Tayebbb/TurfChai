package com.turfchai.dto.request;

import com.turfchai.model.enums.SkillLevel;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateOpenGameRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotNull(message = "Venue ID is required")
    private Long venueId;

    private Long pitchId;

    @NotNull(message = "Game date is required")
    @FutureOrPresent(message = "Game date must be today or in the future")
    private LocalDate gameDate;

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    private SkillLevel skillLevel;

    @NotNull(message = "Capacity is required")
    @Min(value = 2, message = "Capacity must be at least 2")
    @Max(value = 50, message = "Capacity cannot exceed 50")
    private Integer capacity;

    @NotNull(message = "Price per player is required")
    @Min(value = 0, message = "Price cannot be negative")
    private BigDecimal pricePerPlayer;

    // The entity caps this at 0..100. Without the same bound here the request
    // passed validation and then failed at persist time, so a bad number came
    // back as a 500 blaming the server for the caller's input.
    @Min(value = 0, message = "Minimum reliability cannot be negative")
    @Max(value = 100, message = "Minimum reliability cannot exceed 100")
    private Integer minimumReliability;
}
