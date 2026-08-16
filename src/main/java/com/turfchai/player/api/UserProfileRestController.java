package com.turfchai.player.api;

import com.turfchai.player.dto.PlayerProfileDto;
import com.turfchai.player.dto.UpdateProfileRequest;
import com.turfchai.player.service.UserProfileService;
import com.turfchai.security.AuthenticatedUser;
import com.turfchai.security.UserPrincipal;
import com.turfchai.venue.dto.VenueSummaryDto;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Player profile + saved venues.
 *
 * <p>
 * "me" is always the authenticated principal. There is deliberately no way
 * for a caller to name a different user: no {@code X-User-Id} header, no query
 * parameter and no demo fallback.
 */
@RestController
@RequestMapping("/api/v1/players")
@SecurityRequirement(name = "bearerAuth")
public class UserProfileRestController {

    private final UserProfileService profileService;
    private final com.turfchai.player.service.PlayerStatsService statsService;

    public UserProfileRestController(UserProfileService profileService,
            com.turfchai.player.service.PlayerStatsService statsService) {
        this.profileService = profileService;
        this.statsService = statsService;
    }

    private UUID currentUserId(UserPrincipal principal) {
        return AuthenticatedUser.requirePublicId(principal);
    }

    @GetMapping("/me")
    public ResponseEntity<PlayerProfileDto> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(profileService.getProfile(currentUserId(principal)));
    }

    /**
     * GET /api/v1/players/me/stats — activity summary derived from the caller's own
     * records.
     */
    @GetMapping("/me/stats")
    public ResponseEntity<com.turfchai.player.dto.PlayerStatsResponse> myStats(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(statsService.forUser(
                com.turfchai.security.AuthenticatedUser.requireId(principal)));
    }

    @PatchMapping("/me")
    public ResponseEntity<PlayerProfileDto> updateMe(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateProfile(currentUserId(principal), request));
    }

    @GetMapping("/me/saved-venues")
    public ResponseEntity<List<VenueSummaryDto>> savedVenues(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(profileService.listSavedVenues(currentUserId(principal)));
    }

    /** Toggle: saves the venue if unsaved, removes the bookmark otherwise. */
    @PostMapping("/me/saved-venues/{venueSlug}")
    public ResponseEntity<Map<String, Boolean>> toggleSaved(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String venueSlug) {
        boolean saved = profileService.toggleSavedVenue(currentUserId(principal), venueSlug);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    @DeleteMapping("/me/saved-venues/{venueSlug}")
    public ResponseEntity<Void> removeSaved(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String venueSlug) {
        profileService.removeSavedVenue(currentUserId(principal), venueSlug);
        return ResponseEntity.noContent().build();
    }
}
