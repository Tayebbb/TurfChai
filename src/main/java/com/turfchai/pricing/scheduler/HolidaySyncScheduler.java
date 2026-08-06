package com.turfchai.pricing.scheduler;

import com.turfchai.pricing.service.HolidayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@RequiredArgsConstructor
@Slf4j
public class HolidaySyncScheduler {

    private final HolidayService holidayService;

    @Scheduled(cron = "0 0 0 1 * *")
    public void syncMonthlyHolidays() {
        log.info("Running monthly holiday sync...");
        int currentYear = LocalDate.now().getYear();
        holidayService.syncHolidaysForYear(currentYear, "BD");
        
        // Pre-fetch next year if we are in December
        if (LocalDate.now().getMonthValue() == 12) {
            holidayService.syncHolidaysForYear(currentYear + 1, "BD");
        }
    }
}
