package com.turfchai.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.dto.CreateTurfRequestDto;
import com.turfchai.dto.response.TurfRequestResponse;
import com.turfchai.model.TurfRequest;
import com.turfchai.repository.TurfRequestRepository;
import com.turfchai.media.service.MediaUploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/turf-requests")
@RequiredArgsConstructor
@Slf4j
public class OwnerTurfRequestRestController {

    /** What a document column says when the owner supplied nothing. */
    private static final String NOT_SUPPLIED = "PENDING";

    private final TurfRequestRepository turfRequestRepository;
    private final ObjectMapper objectMapper;
    private final MediaUploadService mediaUploadService;

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
                .venueName(clamp(dto.getVenueName(), 100))
                .area(clamp(dto.getArea(), 50))
                .pitchCount(dto.getPitchCount() != null ? dto.getPitchCount() : 1)
                .sportsCsv(clamp(dto.getSportsCsv(), 100))
                .ownerPhone(clamp(dto.getOwnerPhone(), 20))
                // The caller's own address is real; a literal fallback was not.
                .ownerEmail(dto.getOwnerEmail() == null || dto.getOwnerEmail().isBlank()
                        ? email
                        : clamp(dto.getOwnerEmail(), 100))
                .docTradeLicense(clampOr(dto.getDocTradeLicense(), 500, NOT_SUPPLIED))
                .docOwnerNid(clampOr(dto.getDocOwnerNid(), 500, NOT_SUPPLIED))
                .docUtilityBill(clampOr(dto.getDocUtilityBill(), 500, NOT_SUPPLIED))
                .photosJson(photosJson)
                .status("PENDING")
                .build();

        TurfRequest saved = turfRequestRepository.save(request);
        return ResponseEntity.ok(TurfRequestResponse.from(saved));
    }

    /**
     * Trims to the column width. It used to substitute a stand-in for anything
     * blank — a phone number, a sports list, "Trade_License.pdf" — so a request
     * reached the admin looking as though documents had been filed.
     */
    private String clamp(String str, int maxLen) {
        return clampOr(str, maxLen, null);
    }

    private String clampOr(String str, int maxLen, String whenBlank) {
        if (str == null || str.isBlank()) {
            return whenBlank;
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

    /**
     * Uploads verification document (Trade License, Lease Proof, etc.)
     * and stores it to Cloudinary/storage.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "type", required = false, defaultValue = "document") String docType) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided"));
        }
        try {
            String url = mediaUploadService.uploadDocument(file, docType);
            String filename = file.getOriginalFilename();
            return ResponseEntity.ok(Map.of(
                    "status", "UPLOADED",
                    "url", url,
                    "file", filename == null ? "" : filename));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("message", ex.getMessage()));
        } catch (IOException ex) {
            log.error("Failed to upload document", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Document upload failed. Please try again."));
        }
    }
}
