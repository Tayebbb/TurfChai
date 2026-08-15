package com.turfchai.pricing.api;

import com.turfchai.pricing.entity.Holiday;
import com.turfchai.pricing.repository.HolidayRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/holidays")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
public class AdminHolidayRestController {

    private final HolidayRepository holidayRepository;

    @GetMapping
    public ResponseEntity<List<Holiday>> getAllHolidays() {
        return ResponseEntity.ok(holidayRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Holiday> addHoliday(@RequestBody Holiday holiday) {
        holiday.setManualOverride(true);
        return ResponseEntity.ok(holidayRepository.save(holiday));
    }

    @PutMapping("/{date}")
    public ResponseEntity<Holiday> updateHoliday(@PathVariable LocalDate date, @RequestBody Holiday holiday) {
        return holidayRepository.findById(date)
                .map(existing -> {
                    existing.setDescription(holiday.getDescription());
                    existing.setManualOverride(true);
                    return ResponseEntity.ok(holidayRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{date}")
    public ResponseEntity<Void> deleteHoliday(@PathVariable LocalDate date) {
        if (holidayRepository.existsById(date)) {
            holidayRepository.deleteById(date);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
