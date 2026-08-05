package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinOpenGameResponse {
    private Boolean success;
    private String message;
    private Long membershipId;
    private Long openGameId;
    private Integer filledCount;
    private Integer capacity;
}
