package com.turfchai.pricing.scheduler;

import com.turfchai.pricing.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyWeatherSyncScheduler {

    private final WeatherService weatherService;

    @Scheduled(cron = "0 1 0 * * *")
    public void syncDailyWeather() {
        log.info("Running daily weather sync...");
        weatherService.sync14DayWeather();
    }
}
