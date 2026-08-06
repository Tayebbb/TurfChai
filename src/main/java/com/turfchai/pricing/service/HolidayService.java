package com.turfchai.pricing.service;

import com.turfchai.pricing.entity.Holiday;
import com.turfchai.pricing.repository.HolidayRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class HolidayService {

    private final HolidayRepository holidayRepository;
    private final WebClient webClient = WebClient.create("https://date.nager.at/api/v3");

    @Transactional
    public void syncHolidaysForYear(int year, String countryCode) {
        log.info("Syncing holidays for year {} and country {}", year, countryCode);
        
        try {
            List<Map> nagerHolidays = webClient.get()
                    .uri("/PublicHolidays/{year}/{countryCode}", year, countryCode)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();

            if (nagerHolidays != null) {
                for (Map holidayData : nagerHolidays) {
                    LocalDate date = LocalDate.parse((String) holidayData.get("date"));
                    String name = (String) holidayData.get("name");

                    holidayRepository.findById(date).ifPresentOrElse(
                            existing -> {
                                if (!existing.isManualOverride()) {
                                    existing.setDescription(name);
                                    holidayRepository.save(existing);
                                }
                            },
                            () -> {
                                Holiday newHoliday = Holiday.builder()
                                        .holidayDate(date)
                                        .description(name)
                                        .isManualOverride(false)
                                        .build();
                                holidayRepository.save(newHoliday);
                            }
                    );
                }
            }
        } catch (Exception e) {
            log.error("Failed to sync holidays from Nager API", e);
        }
    }
}
