package com.turfchai.pricing.service;

import com.turfchai.pricing.entity.WeatherForecastGrid;
import com.turfchai.pricing.repository.WeatherForecastGridRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WeatherService {

    private final VenueRepository venueRepository;
    private final WeatherForecastGridRepository weatherForecastGridRepository;
    private final WebClient webClient = WebClient.create("https://api.open-meteo.com/v1");

    @Transactional
    public void sync14DayWeather() {
        log.info("Starting 14-day weather sync...");
        List<Object[]> gridCoordinates = venueRepository.findDistinctGridCoordinates();
        
        for (Object[] coords : gridCoordinates) {
            BigDecimal lat = (BigDecimal) coords[0];
            BigDecimal lon = (BigDecimal) coords[1];
            syncWeatherForGrid(lat, lon);
        }
        
        // Cleanup stale data (older than today)
        cleanupStaleData();
        log.info("Weather sync completed.");
    }

    private void syncWeatherForGrid(BigDecimal lat, BigDecimal lon) {
        try {
            Map response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/forecast")
                            .queryParam("latitude", lat)
                            .queryParam("longitude", lon)
                            .queryParam("hourly", "weathercode")
                            .queryParam("forecast_days", 14)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("hourly")) {
                Map<String, List> hourly = (Map<String, List>) response.get("hourly");
                List<String> times = hourly.get("time");
                List<Integer> codes = hourly.get("weathercode");

                List<WeatherForecastGrid> entities = new ArrayList<>();
                for (int i = 0; i < times.size(); i++) {
                    LocalDateTime localDateTime = LocalDateTime.parse(times.get(i));
                    OffsetDateTime forecastDatetime = localDateTime.atOffset(ZoneOffset.UTC); // Open-Meteo returns UTC by default unless timezone specified
                    
                    int code = codes.get(i) != null ? (Integer) codes.get(i) : 0;
                    short mappedCode = mapWeatherCode(code);

                    entities.add(WeatherForecastGrid.builder()
                            .roundedLatitude(lat)
                            .roundedLongitude(lon)
                            .forecastDatetime(forecastDatetime)
                            .weatherCondition(mappedCode)
                            .build());
                }
                
                weatherForecastGridRepository.saveAll(entities);
            }
        } catch (Exception e) {
            log.error("Failed to sync weather for lat: {}, lon: {}", lat, lon, e);
        }
    }

    private short mapWeatherCode(int code) {
        // 0-1: Clear (0)
        // 2-3: Cloudy (1)
        // 45+: Rain (2)
        if (code <= 1) return 0;
        if (code <= 3) return 1;
        return 2;
    }
    
    private void cleanupStaleData() {
        weatherForecastGridRepository.deleteByForecastDatetimeBefore(OffsetDateTime.now());
    }
}
