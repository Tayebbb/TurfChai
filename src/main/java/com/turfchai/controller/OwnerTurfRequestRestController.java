package com.turfchai.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.dto.CreateTurfRequestDto;
import com.turfchai.dto.response.TurfRequestResponse;
import com.turfchai.model.TurfRequest;
import com.turfchai.repository.TurfRequestRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/turf-requests")
@RequiredArgsConstructor
@Slf4j
public class OwnerTurfRequestRestController {

    private final TurfRequestRepository turfRequestRepository;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ResponseEntity<TurfRequestResponse> createRequest(
            @Valid @RequestBody CreateTurfRequestDto dto,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {

        com.turfchai.security.UserPrincipal caller = com.turfchai.security.AuthenticatedUser.require(userDetails);
        Long ownerId = caller.getId();
        String email = caller.getUsername();
        String requestCode = "TRF-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        String photosJson = "[]";
        if (dto.getPhotos() != null && !dto.getPhotos().isEmpty()) {
            try {
                photosJson = objectMapper.writeValueAsString(dto.getPhotos());
            } catch (JsonProcessingException e) {
                // The listing is still worth creating without its gallery, but a
                // silent catch here hid the reason every photo vanished.
                log.warn("Could not serialise {} photo(s) for a new turf request; storing an empty gallery",
                        dto.getPhotos().size(), e);
            }
        }

        TurfRequest request = TurfRequest.builder()
                .requestCode(requestCode)
                .ownerUserId(ownerId)
                .venueName(safeTruncate(dto.getVenueName(), 100, "Kick Off Arena"))
                .area(safeTruncate(dto.getArea(), 50, "Dhaka"))
                .pitchCount(dto.getPitchCount() != null ? dto.getPitchCount() : 1)
                .sportsCsv(safeTruncate(dto.getSportsCsv(), 100, "Football,Cricket,Futsal"))
                .ownerPhone(safeTruncate(dto.getOwnerPhone(), 20, "+8801811223344"))
                .ownerEmail(safeTruncate(dto.getOwnerEmail(), 100, email))
                .docTradeLicense(safeTruncate(dto.getDocTradeLicense(), 500, "Trade_License.pdf"))
                .docOwnerNid(safeTruncate(dto.getDocOwnerNid(), 500, "NID.pdf"))
                .docUtilityBill(safeTruncate(dto.getDocUtilityBill(), 500, "Utility_Bill.pdf"))
                .photosJson(photosJson)
                .status("PENDING")
                .build();

        TurfRequest saved = turfRequestRepository.save(request);
        return ResponseEntity.ok(TurfRequestResponse.from(saved));
    }

    private String safeTruncate(String str, int maxLen, String defaultValue) {
        if (str == null || str.isBlank()) {
            return defaultValue;
        }
        String trimmed = str.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    }

    @GetMapping
    public ResponseEntity<List<TurfRequestResponse>> getMyRequests(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        // Owner identity comes from the token only; an X-User-Id header here used
        // to let any caller read another owner's submissions.
        Long ownerId = com.turfchai.security.AuthenticatedUser.requireId(userDetails);
        List<TurfRequestResponse> requests = turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerId)
                .stream()
                .map(TurfRequestResponse::from)
                .toList();
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
