package com.turfchai.pricing.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WeatherForecastGridId implements Serializable {
    private BigDecimal roundedLatitude;
    private BigDecimal roundedLongitude;
    private OffsetDateTime forecastDatetime;
}
