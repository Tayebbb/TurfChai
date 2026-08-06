package com.turfchai.reward.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TierResponse {
    private String name;
    private Integer minPoints;
    private BigDecimal discountPercent;
    private Map<String, Object> perks;
}
