package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuditLogService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/venues")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*")
public class AdminVenueRestController {

    private final VenueRepository venueRepository;
    private final AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Venue>>> listVenues(@RequestParam(required = false) String status) {
        List<Venue> list;
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            list = venueRepository.findAll().stream()
                    .filter(v -> v.getStatus() != null && v.getStatus().equalsIgnoreCase(status))
                    .toList();
        } else {
            list = venueRepository.findAll();
        }
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Venue>> getVenue(@PathVariable Long id) {
        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found with id " + id));
        return ResponseEntity.ok(ApiResponse.ok(venue));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<Venue>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String newStatus = payload.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("Status field is required");
        }

        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found with id " + id));

        venue.setStatus(newStatus.toUpperCase());
        Venue saved = venueRepository.save(venue);

        String tone = "ARCHIVED".equalsIgnoreCase(newStatus) || "SUSPENDED".equalsIgnoreCase(newStatus) ? "red" : "green";
        auditLogService.logAction(
                principal.getUsername(),
                principal.getId(),
                "Venue Status Updated",
                tone,
                "V-" + id,
                "Venue " + venue.getName() + " status changed to " + newStatus.toUpperCase()
        );

        return ResponseEntity.ok(ApiResponse.ok(saved));
    }
}
