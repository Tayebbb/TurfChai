package com.turfchai.booking.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSplitRequest {

    @NotNull(message = "Player count is required")
    @Min(value = 2, message = "Player count must be at least 2")
    @Max(value = 50, message = "Player count cannot exceed 50")
    private Integer playerCount;
}
