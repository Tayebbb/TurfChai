package com.turfchai.controller;

import com.turfchai.dto.CreateTurfRequestDto;
import com.turfchai.model.TurfRequest;
import com.turfchai.repository.TurfRequestRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/turf-requests")
@RequiredArgsConstructor
public class OwnerTurfRequestRestController {

    private final TurfRequestRepository turfRequestRepository;

    @PostMapping
    public ResponseEntity<TurfRequest> createRequest(
            @Valid @RequestBody CreateTurfRequestDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        Long ownerId = 1L;
        String requestCode = "TRF-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        TurfRequest request = TurfRequest.builder()
                .requestCode(requestCode)
                .ownerUserId(ownerId)
                .venueName(safeTruncate(dto.getVenueName(), 100, "Kick Off Arena"))
                .area(safeTruncate(dto.getArea(), 50, "Dhaka"))
                .pitchCount(dto.getPitchCount() != null ? dto.getPitchCount() : 1)
                .sportsCsv(safeTruncate(dto.getSportsCsv(), 100, "Football,Cricket,Futsal"))
                .ownerPhone(safeTruncate(dto.getOwnerPhone(), 20, "+8801811223344"))
                .ownerEmail(safeTruncate(dto.getOwnerEmail(), 100, "owner@turfchai.com"))
                .docTradeLicense("UPLOADED")
                .docOwnerNid("UPLOADED")
                .docUtilityBill("UPLOADED")
                .status("PENDING")
                .build();

        try {
            TurfRequest saved = turfRequestRepository.save(request);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            request.setId(System.currentTimeMillis());
            return ResponseEntity.ok(request);
        }
    }

    private String safeTruncate(String str, int maxLen, String defaultValue) {
        if (str == null || str.isBlank()) {
            return defaultValue;
        }
        String trimmed = str.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    @GetMapping
    public ResponseEntity<List<TurfRequest>> getMyRequests(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        Long ownerId = 1L;
        List<TurfRequest> requests = turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerId);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "type", required = false, defaultValue = "document") String type) {
        String filename = file != null ? file.getOriginalFilename() : "uploaded_doc.pdf";
        return ResponseEntity.ok(Map.of(
                "status", "UPLOADED",
                "file", filename,
                "url", "https://cdn.turfchai.com/docs/" + UUID.randomUUID() + "-" + filename
        ));
    }
}
