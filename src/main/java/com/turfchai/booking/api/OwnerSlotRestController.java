package com.turfchai.booking.api;

import com.turfchai.booking.dto.request.SlotGenerationRequest;
import com.turfchai.booking.dto.request.UpdateSlotRequest;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.service.SlotManagementService;
import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/v1/owner/slots")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Transactional
public class OwnerSlotRestController {

    private final SlotManagementService slotManagementService;

    @PostMapping("/generate")
    public ResponseEntity<List<Map<String, Object>>> generateSlots(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody SlotGenerationRequest request) {
        
        List<Slot> generated = slotManagementService.generateSlots(principal.getId(), request);
        return ResponseEntity.ok(generated.stream().map(this::toResponse).collect(Collectors.toList()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateSlot(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateSlotRequest request) {
        
        Slot updated = slotManagementService.updateSlot(principal.getId(), id, request);
        return ResponseEntity.ok(toResponse(updated));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getSlots(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Long venueId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        List<Slot> slots = slotManagementService.getOwnerSlots(principal.getId(), venueId, startDate, endDate);
        return ResponseEntity.ok(slots.stream().map(this::toResponse).collect(Collectors.toList()));
    }

    private Map<String, Object> toResponse(Slot slot) {
        return Map.of(
                "id", slot.getId(),
                "pitchId", slot.getPitch().getId(),
                "pitchName", slot.getPitch().getName(),
                "slotDate", slot.getSlotDate().toString(),
                "startTime", slot.getStartTime().toString(),
                "endTime", slot.getEndTime().toString(),
                "price", slot.getPrice(),
                "status", slot.getStatus().name()
        );
    }
}
