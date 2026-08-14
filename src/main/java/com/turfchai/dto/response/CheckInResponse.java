package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

/** Result of scanning a ticket at the gate. A refused ticket is a 4xx, not a body flag. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckInResponse {
    private String message;
    private Long gameId;
    private String gameCode;
    private String title;
    private Long userId;
    private String holderName;
    private LocalDate gameDate;
    private LocalTime startTime;
}
