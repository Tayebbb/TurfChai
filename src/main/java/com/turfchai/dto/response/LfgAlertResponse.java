package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LfgAlertResponse {
    private Long id;
    private Long userId;
    private Long sportId;
    private String sportName;
    private String area;
    private String preferredDays;
    private LocalTime preferredFrom;
    private LocalTime preferredTo;
    private String skillLevel;
    private String status;
    private OffsetDateTime lastMatchedAt;
    private OffsetDateTime createdAt;
}
