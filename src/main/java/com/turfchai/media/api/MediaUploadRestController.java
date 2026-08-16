package com.turfchai.media.api;

import com.turfchai.media.service.MediaUploadService;
import com.turfchai.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Media upload REST API.
 *
 * <pre>
 * POST /api/v1/media/upload                   — generic upload (authenticated)
 * POST /api/v1/media/venues/{venueId}/photo   — upload venue photo (owner/admin)
 * POST /api/v1/media/avatar                   — upload own user avatar
 * </pre>
 *
 * All endpoints consume multipart/form-data with a single "file" part.
 * Responses return a JSON object {@code {"url": "https://res.cloudinary.com/..."}}
 */
@RestController
@RequestMapping("/api/v1/media")
public class MediaUploadRestController {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(MediaUploadRestController.class);

    private final MediaUploadService mediaUploadService;
    private final com.turfchai.venue.service.VenueManagementService venueManagementService;

    public MediaUploadRestController(MediaUploadService mediaUploadService,
                                     com.turfchai.venue.service.VenueManagementService venueManagementService) {
        this.mediaUploadService = mediaUploadService;
        this.venueManagementService = venueManagementService;
    }

    /** Generic authenticated upload — stores in TurfChai/general/ */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file) throws IOException {
        String url = mediaUploadService.uploadGeneric(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }

    /** Upload a photo for a specific venue — stores in TurfChai/venues/{venueId}/ */
    @PostMapping(value = "/venues/{venueId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadVenuePhoto(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long venueId,
            @RequestParam("file") MultipartFile file) throws IOException {
        // Ownership is always checked: skipping it when the principal was absent
        // let an unauthenticated caller attach photos to any venue.
        Long ownerId = com.turfchai.security.AuthenticatedUser.requireId(principal);
        venueManagementService.requireOwnership(ownerId, venueId);
        String url = mediaUploadService.uploadVenuePhoto(file, venueId);
        venueManagementService.addVenuePhoto(ownerId, venueId, url);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }

    /** Upload the authenticated user's avatar — stores in TurfChai/avatars/ */
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadAvatar(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file) throws IOException {
        String url = mediaUploadService.uploadAvatar(file, com.turfchai.security.AuthenticatedUser.requireId(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("url", url));
    }

    /** Validation and IO errors map to 400 / 422 rather than 500. */
    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(com.turfchai.exception.ApiErrorBody.of(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IOException.class)
    public ResponseEntity<Map<String, Object>> handleIo(IOException ex) {
        // The cause goes to the log; echoing it told callers about storage
        // paths and provider errors they can do nothing with.
        log.error("Media upload failed", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(com.turfchai.exception.ApiErrorBody.of(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Upload failed. Please try again."));
    }
}
