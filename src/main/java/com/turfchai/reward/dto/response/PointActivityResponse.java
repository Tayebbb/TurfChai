package com.turfchai.reward.dto.response;

import com.turfchai.reward.entity.PointReason;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/** A single row in the "recent points activity" feed. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointActivityResponse {
    private Long id;
    private Integer delta;
    private PointReason reason;
    private String note;
    private Integer balanceAfter;
    private OffsetDateTime createdAt;
}
