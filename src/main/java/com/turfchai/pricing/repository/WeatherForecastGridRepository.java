package com.turfchai.pricing.repository;

import com.turfchai.pricing.entity.WeatherForecastGrid;
import com.turfchai.pricing.entity.WeatherForecastGridId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WeatherForecastGridRepository extends JpaRepository<WeatherForecastGrid, WeatherForecastGridId> {
    void deleteByForecastDatetimeBefore(java.time.OffsetDateTime dateTime);
}
