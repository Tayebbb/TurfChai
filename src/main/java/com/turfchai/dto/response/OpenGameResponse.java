package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpenGameResponse {
    private Long id;
    private String gameCode;
    private String title;
    private Long venueId;
    private String venueName;
    private String area;
    private Long pitchId;
    private String pitchName;
    private LocalDate gameDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String skillLevel;
    private Integer capacity;
    private Integer filledCount;
    private Integer spotsLeft;
    private BigDecimal pricePerPlayer;
    private Long organizerId;
    private String organizerName;
    private String status;
    private Integer minimumReliability;
    private List<OpenGameMemberResponse> members;
}
