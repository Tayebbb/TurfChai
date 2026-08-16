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

    /** What a document column says when the owner supplied nothing. */
    private static final String NOT_SUPPLIED = "PENDING";

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
     * Records the name of a document the owner is submitting for verification.
     *
     * <p>
     * TurfChai has no document store, so nothing is filed here. This used to
     * answer {@code UPLOADED} with a {@code cdn.turfchai.com} URL that had never
     * existed, which told the owner their trade licence was on file.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadDocument(
            @RequestParam(value = "file", required = false) MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided"));
        }
        String filename = file.getOriginalFilename();
        return ResponseEntity.ok(Map.of(
                "status", "NAME_RECORDED",
                "file", filename == null ? "" : filename));
    }
}
