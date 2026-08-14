package com.turfchai.controller;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.LfgStatus;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.LfgAlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * LFG availability alerts.
 *
 * <p>The owner is always the authenticated principal. These routes used to take
 * the user id from the request, which meant the ownership checks downstream
 * could be satisfied simply by naming the victim.
 */
@RestController
@RequestMapping("/api/v1/solo/lfg-alerts")
@RequiredArgsConstructor
public class LfgAlertRestController {

    private final LfgAlertService alertService;

    @PostMapping
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<LfgAlertResponse> createAlert(@AuthenticationPrincipal UserPrincipal principal,
                                                        @Valid @RequestBody CreateLfgAlertRequest request) {
        LfgAlertResponse response = alertService.createAlert(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<List<LfgAlertResponse>> getMyAlerts(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(alertService.getUserAlerts(principal.getId()));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<LfgAlertResponse> updateAlertStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam LfgStatus status) {
        return ResponseEntity.ok(alertService.updateAlertStatus(id, principal.getId(), status));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<Void> deleteAlert(@AuthenticationPrincipal UserPrincipal principal,
                                            @PathVariable Long id) {
        alertService.deleteAlert(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/matches")
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<List<OpenGameResponse>> getAlertMatches(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.ok(alertService.findMatchesForAlert(id, principal.getId()));
    }
}
