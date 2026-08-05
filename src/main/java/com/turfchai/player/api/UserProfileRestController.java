package com.turfchai.player.api;

import com.turfchai.player.dto.PlayerProfileDto;
import com.turfchai.player.dto.UpdateProfileRequest;
import com.turfchai.player.service.UserProfileService;
import com.turfchai.venue.dto.VenueSummaryDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Player profile + saved venues.
 *
 * <p>TEMPORARY IDENTITY: the caller is selected via the {@code X-User-Id}
 * header (public UUID), falling back to the seeded demo player. This will
 * be replaced by the JWT security principal when the authentication task
 * (owned by another developer) lands — only {@link #currentUserId} changes.
 */
@RestController
@RequestMapping("/api/v1/players")
public class UserProfileRestController {

    /** Public id of the seeded demo player (see PlayerDataSeeder). */
    public static final UUID DEMO_USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private final UserProfileService profileService;

    public UserProfileRestController(UserProfileService profileService) {
        this.profileService = profileService;
    }

    private UUID currentUserId(String header) {
        if (header == null || header.isBlank()) {
            return DEMO_USER_ID;
        }
        try {
            return UUID.fromString(header.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("X-User-Id must be a UUID");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<PlayerProfileDto> me(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader) {
        return ResponseEntity.ok(profileService.getProfile(currentUserId(userHeader)));
    }

    @PatchMapping("/me")
    public ResponseEntity<PlayerProfileDto> updateMe(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateProfile(currentUserId(userHeader), request));
    }

    @GetMapping("/me/saved-venues")
    public ResponseEntity<List<VenueSummaryDto>> savedVenues(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader) {
        return ResponseEntity.ok(profileService.listSavedVenues(currentUserId(userHeader)));
    }

    /** Toggle: saves the venue if unsaved, removes the bookmark otherwise. */
    @PostMapping("/me/saved-venues/{venueSlug}")
    public ResponseEntity<Map<String, Boolean>> toggleSaved(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader,
            @PathVariable String venueSlug) {
        boolean saved = profileService.toggleSavedVenue(currentUserId(userHeader), venueSlug);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    @DeleteMapping("/me/saved-venues/{venueSlug}")
    public ResponseEntity<Void> removeSaved(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader,
            @PathVariable String venueSlug) {
        profileService.removeSavedVenue(currentUserId(userHeader), venueSlug);
        return ResponseEntity.noContent().build();
    }
}
