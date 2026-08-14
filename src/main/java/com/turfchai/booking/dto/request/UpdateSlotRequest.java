package com.turfchai.booking.dto.request;

import com.turfchai.booking.entity.SlotStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
public class UpdateSlotRequest {
    private BigDecimal price;
    private SlotStatus status;
}
