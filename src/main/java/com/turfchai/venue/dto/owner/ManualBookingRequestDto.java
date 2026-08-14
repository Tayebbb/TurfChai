package com.turfchai.venue.dto.owner;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualBookingRequestDto {
    private Long slotId;
    private Long pitchId;
    private String customerName;
    private String customerPhone;
    private String source;
    private String paymentStatus;
    private String notes;
}
