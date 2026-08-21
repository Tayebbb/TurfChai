package com.turfchai.booking.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@NoArgsConstructor
public class SlotGenerationRequest {
    @NotNull
    private Long pitchId;

    @NotNull
    private LocalDate startDate;

    @NotNull
    private LocalDate endDate;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    @Min(15)
    private int slotDurationMinutes = 60;

    @Min(0)
    private int bufferMinutes = 0;

    @NotNull
    @Min(0)
    private BigDecimal basePrice;
}
