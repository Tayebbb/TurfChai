package com.turfchai.pricing.api;

import com.turfchai.pricing.dto.HolidayDto;
import com.turfchai.pricing.entity.Holiday;
import com.turfchai.pricing.repository.HolidayRepository;
import jakarta.validation.Valid;
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
    public ResponseEntity<List<HolidayDto.Response>> getAllHolidays() {
        return ResponseEntity.ok(holidayRepository.findAll().stream().map(HolidayDto.Response::from).toList());
    }

    @PostMapping
    public ResponseEntity<HolidayDto.Response> addHoliday(@Valid @RequestBody HolidayDto.CreateRequest request) {
        Holiday holiday = Holiday.builder()
                .holidayDate(request.holidayDate())
                .description(request.description())
                .isManualOverride(true)
                .build();
        return ResponseEntity.ok(HolidayDto.Response.from(holidayRepository.save(holiday)));
    }

    @PutMapping("/{date}")
    public ResponseEntity<HolidayDto.Response> updateHoliday(
            @PathVariable LocalDate date,
            @Valid @RequestBody HolidayDto.UpdateRequest request) {
        return holidayRepository.findById(date)
                .map(existing -> {
                    existing.setDescription(request.description());
                    existing.setManualOverride(true);
                    return ResponseEntity.ok(HolidayDto.Response.from(holidayRepository.save(existing)));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
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
