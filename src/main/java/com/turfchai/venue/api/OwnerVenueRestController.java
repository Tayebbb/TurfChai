package com.turfchai.venue.api;

import com.turfchai.security.UserPrincipal;
import com.turfchai.venue.dto.owner.CreatePitchRequest;
import com.turfchai.venue.dto.owner.CreateVenueRequest;
import com.turfchai.venue.dto.owner.SlotPriceResponse;
import com.turfchai.venue.dto.owner.UpdatePitchRequest;
import com.turfchai.venue.dto.owner.UpdateVenueRequest;
import com.turfchai.venue.dto.owner.UpsertPricingRuleRequest;
import com.turfchai.venue.dto.owner.VenueManagementDto;
import com.turfchai.venue.service.SlotPricingRuleEngine;
import com.turfchai.venue.service.VenueManagementService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Owner venue management API.
 *
 * <pre>
 * POST   /api/v1/owner/venues                              — create venue
 * GET    /api/v1/owner/venues                              — list my venues
 * GET    /api/v1/owner/venues/{id}                         — get venue
 * PUT    /api/v1/owner/venues/{id}                         — update venue
 * POST   /api/v1/owner/venues/{id}/pitches                 — add pitch
 * PUT    /api/v1/owner/venues/{id}/pitches/{pitchId}       — update pitch
 * DELETE /api/v1/owner/venues/{id}/pitches/{pitchId}       — deactivate pitch
 * POST   /api/v1/owner/venues/{id}/pricing-rules           — upsert pricing rule
 * DELETE /api/v1/owner/venues/{id}/pricing-rules/{ruleId}  — remove rule
 * PUT    /api/v1/owner/venues/{id}/ml-settings             — toggle ML pricing
 * GET    /api/v1/owner/venues/{id}/slot-price              — calculate slot price
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/owner/venues")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
public class OwnerVenueRestController {

    private final VenueManagementService managementService;
    private final SlotPricingRuleEngine pricingEngine;

    public OwnerVenueRestController(VenueManagementService managementService,
                                     SlotPricingRuleEngine pricingEngine) {
        this.managementService = managementService;
        this.pricingEngine = pricingEngine;
    }

    // ── Venues ─────────────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VenueManagementDto createVenue(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateVenueRequest request) {
        return managementService.createVenue(principal.getId(), request);
    }

    @GetMapping
    public List<VenueManagementDto> listVenues(
            @AuthenticationPrincipal UserPrincipal principal) {
        return managementService.listOwnerVenues(principal.getId());
    }

    @GetMapping("/{id}")
    public VenueManagementDto getVenue(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {
        return managementService.getOwnerVenue(principal.getId(), id);
    }

    @PutMapping("/{id}")
    public VenueManagementDto updateVenue(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateVenueRequest request) {
        return managementService.updateVenue(principal.getId(), id, request);
    }

    @PutMapping("/{id}/ml-settings")
    public VenueManagementDto updateMlSettings(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Boolean> request) {
        Boolean enabled = request.getOrDefault("mlPricingEnabled", true);
        return managementService.updateMlSettings(principal.getId(), id, enabled);
    }

    // ── Pitches ────────────────────────────────────────────────────────────

    @PostMapping("/{id}/pitches")
    @ResponseStatus(HttpStatus.CREATED)
    public VenueManagementDto.PitchDto addPitch(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody CreatePitchRequest request) {
        return managementService.addPitch(principal.getId(), id, request);
    }

    @PutMapping("/{id}/pitches/{pitchId}")
    public VenueManagementDto.PitchDto updatePitch(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long pitchId,
            @Valid @RequestBody UpdatePitchRequest request) {
        return managementService.updatePitch(principal.getId(), id, pitchId, request);
    }

    @DeleteMapping("/{id}/pitches/{pitchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivatePitch(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long pitchId) {
        managementService.deactivatePitch(principal.getId(), id, pitchId);
    }

    // ── Pricing Rules ──────────────────────────────────────────────────────

    @PostMapping("/{id}/pricing-rules")
    @ResponseStatus(HttpStatus.CREATED)
    public VenueManagementDto.PricingRuleDto upsertPricingRule(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpsertPricingRuleRequest request) {
        return managementService.upsertPricingRule(principal.getId(), id, request);
    }

    @DeleteMapping("/{id}/pricing-rules/{ruleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePricingRule(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long ruleId) {
        managementService.deletePricingRule(principal.getId(), id, ruleId);
    }

    // ── Owner Calendar Grid ────────────────────────────────────────────────
    @GetMapping("/{id}/calendar")
    public ResponseEntity<com.turfchai.venue.dto.owner.OwnerCalendarDto> getCalendar(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Long ownerId = principal != null ? principal.getId() : 1L;
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(managementService.getOwnerCalendar(ownerId, id, targetDate));
    }

    @PostMapping("/{id}/slots/{slotId}/block")
    public ResponseEntity<Void> blockSlot(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long slotId) {
        Long ownerId = principal != null ? principal.getId() : 1L;
        managementService.blockSlot(ownerId, id, slotId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/manual-booking")
    public ResponseEntity<Void> createManualBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody com.turfchai.venue.dto.owner.ManualBookingRequestDto req) {
        Long ownerId = principal != null ? principal.getId() : 1L;
        managementService.createManualBooking(ownerId, id, req);
        return ResponseEntity.ok().build();
    }

    // ── Dynamic Slot Price ─────────────────────────────────────────────────

    /**
     * GET /api/v1/owner/venues/{id}/slot-price?sport=football&date=2026-08-10&start=18:00&end=19:30
     */
    @GetMapping("/{id}/slot-price")
    public ResponseEntity<SlotPriceResponse> getSlotPrice(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam String sport,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime end) {
        SlotPriceResponse price = pricingEngine.calculate(id, sport, date, start, end);
        return ResponseEntity.ok(price);
    }
}
