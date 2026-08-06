package com.turfchai.booking.api;

import com.turfchai.booking.dto.response.SlotResponse;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Read-only slot availability for the venue page's booking grid. Lives under
 * {@code /api/v1/venues/**}, which {@code SecurityConfig} already treats as
 * public — a player should be able to see availability before logging in,
 * the same way venue browsing works. Login is only required starting at
 * {@code POST /api/v1/bookings/hold-slot}.
 */
@RestController
@RequestMapping("/api/v1/venues")
@RequiredArgsConstructor
public class SlotRestController {

    private final SlotRepository slotRepository;

    /** GET /api/v1/venues/{venueId}/slots?date=YYYY-MM-DD — a venue's slots for one day, earliest first. */
    @GetMapping("/{venueId}/slots")
    public ResponseEntity<List<SlotResponse>> listSlots(
            @PathVariable Long venueId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<SlotResponse> slots = slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venueId, date)
                .stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(slots);
    }

    private SlotResponse toResponse(Slot slot) {
        return SlotResponse.builder()
                .id(slot.getId())
                .pitchId(slot.getPitch() != null ? slot.getPitch().getId() : null)
                .pitchName(slot.getPitch() != null ? slot.getPitch().getName() : null)
                .slotDate(slot.getSlotDate())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .price(slot.getPrice())
                .status(displayStatus(slot))
                .build();
    }

    /**
     * A HELD slot whose hold has already lapsed reads as AVAILABLE — the
     * async cleanup job (30s cadence) will catch up and persist that; this
     * just avoids showing a stale "held" state in the meantime.
     */
    private String displayStatus(Slot slot) {
        if (slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(OffsetDateTime.now())) {
            return SlotStatus.AVAILABLE.name();
        }
        return slot.getStatus().name();
    }
}
