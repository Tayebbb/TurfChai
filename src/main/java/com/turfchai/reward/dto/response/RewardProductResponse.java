package com.turfchai.reward.dto.response;

import com.turfchai.reward.entity.RewardKind;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** A catalog entry as shown on the rewards page, annotated with the caller's unlock state. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardProductResponse {
    private Long id;
    private String name;
    private String description;
    private RewardKind kind;
    private Integer costPoints;
    private BigDecimal value;
    private Boolean locked;
    /** Points still needed to afford this reward; 0 when unlocked. */
    private Integer pointsToUnlock;
}
