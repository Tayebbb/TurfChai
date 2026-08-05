package com.turfchai.controller;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.LfgStatus;
import com.turfchai.service.LfgAlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/solo/lfg-alerts")
@RequiredArgsConstructor
public class LfgAlertRestController {

    private final LfgAlertService alertService;

    @PostMapping
    public ResponseEntity<LfgAlertResponse> createAlert(@Valid @RequestBody CreateLfgAlertRequest request) {
        LfgAlertResponse response = alertService.createAlert(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<LfgAlertResponse>> getUserAlerts(@RequestParam Long userId) {
        List<LfgAlertResponse> alerts = alertService.getUserAlerts(userId);
        return ResponseEntity.ok(alerts);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<LfgAlertResponse> updateAlertStatus(
            @PathVariable Long id,
            @RequestParam Long userId,
            @RequestParam LfgStatus status) {
        LfgAlertResponse response = alertService.updateAlertStatus(id, userId, status);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAlert(
            @PathVariable Long id,
            @RequestParam Long userId) {
        alertService.deleteAlert(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/matches")
    public ResponseEntity<List<OpenGameResponse>> getAlertMatches(@PathVariable Long id) {
        List<OpenGameResponse> matches = alertService.findMatchesForAlert(id);
        return ResponseEntity.ok(matches);
    }
}
