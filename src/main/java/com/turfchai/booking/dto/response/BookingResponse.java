package com.turfchai.booking.dto.response;

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
    private Long id;
    private String bookingCode;
    private Long slotId;
    private Long userId;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    
    // Enriched fields for frontend BookingsPage
    private String title;
    private String venue;
    private String pitch;
    private String date;
    private String time;
    private String duration;
    private String share;
}
