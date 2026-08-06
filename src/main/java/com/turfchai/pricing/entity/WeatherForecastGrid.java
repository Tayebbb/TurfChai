package com.turfchai.pricing.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "weather_forecast_grid")
@IdClass(WeatherForecastGridId.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherForecastGrid {
    @Id
    @Column(name = "rounded_latitude")
    private BigDecimal roundedLatitude;

    @Id
    @Column(name = "rounded_longitude")
    private BigDecimal roundedLongitude;

    @Id
    @Column(name = "forecast_datetime")
    private OffsetDateTime forecastDatetime;

    @Column(name = "weather_condition", nullable = false)
    private short weatherCondition;
}
