package com.turfchai.booking.api;

import com.turfchai.booking.dto.response.SlotResponse;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.booking.service.SlotEventBroadcaster;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    /** Refuse absurd dates outright rather than opening a stream nothing will ever publish to. */
    private static final int MAX_STREAM_DAYS_AHEAD = 365;

    private final SlotRepository slotRepository;
    private final SlotEventBroadcaster slotEventBroadcaster;

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

    /**
     * GET /api/v1/venues/{venueId}/slots/stream?date=YYYY-MM-DD — live
     * availability for one venue/day as Server-Sent Events.
     *
     * <p>Public for the same reason the snapshot above is: availability is not
     * private, and {@code EventSource} cannot attach an {@code Authorization}
     * header, so requiring a token here would break the feature outright
     * rather than secure it. The payload is scoped to what the snapshot
     * already reveals — no holder identity is ever emitted.
     *
     * <p>Clients should re-read the snapshot on every {@code open}: reconnects
     * are silent and any change published while disconnected is not replayed.
     */
    @GetMapping(value = "/{venueId}/slots/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> streamSlots(
            @PathVariable Long venueId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date)
            throws ServletRequestBindingException {

        LocalDate today = LocalDate.now();
        if (date.isBefore(today.minusDays(1)) || date.isAfter(today.plusDays(MAX_STREAM_DAYS_AHEAD))) {
            // Thrown rather than returned so the platform-wide error envelope
            // applies; an empty 400 body here would be the only one in the API.
            throw new ServletRequestBindingException(
                    "Parameter 'date' must be within " + MAX_STREAM_DAYS_AHEAD + " days of today");
        }

        SseEmitter emitter = slotEventBroadcaster.subscribe(venueId, date);
        if (emitter == null) {
            // Body deliberately omitted: EventSource never reads it, and
            // ResponseStatusException would be swallowed by the global
            // catch-all handler and surface as a 500.
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-transform")
                // Tells nginx-style proxies not to buffer, which would otherwise
                // hold events back until the response closed.
                .header("X-Accel-Buffering", "no")
                .body(emitter);
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
