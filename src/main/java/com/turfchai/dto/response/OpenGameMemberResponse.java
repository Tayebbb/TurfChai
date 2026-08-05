package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpenGameMemberResponse {
    private Long id;
    private Long userId;
    private String name;
    private String initials;
    private String avatarUrl;
    private Integer reliabilityScore;
    private String status;
    private Boolean showUp;
    private OffsetDateTime joinedAt;
}
