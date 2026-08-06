package com.turfchai.booking.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoldSlotRequest {

    @NotNull(message = "Slot ID is required")
    @Schema(description = "ID of the slot to hold", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long slotId;
}
