package com.turfchai.player.service;

import com.turfchai.model.User;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.player.dto.PlayerProfileDto;
import com.turfchai.player.dto.UpdateProfileRequest;
import com.turfchai.player.entity.SavedVenue;
import com.turfchai.player.repository.SavedVenueRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/** Player profile management and saved-venue bookmarks. */
@Service
public class UserProfileService {

    private final UserRepository users;
    private final SavedVenueRepository savedVenues;
    private final VenueRepository venues;

    public UserProfileService(UserRepository users, SavedVenueRepository savedVenues, VenueRepository venues) {
        this.users = users;
        this.savedVenues = savedVenues;
        this.venues = venues;
    }

    @Transactional(readOnly = true)
    public PlayerProfileDto getProfile(UUID publicId) {
        return toDto(requireUser(publicId));
    }

    @Transactional
    public PlayerProfileDto updateProfile(UUID publicId, UpdateProfileRequest request) {
        User user = requireUser(publicId);
        if (request.fullName() != null) {
            String trimmed = request.fullName().trim();
            if (trimmed.length() < 2) {
                throw new IllegalArgumentException("fullName must not be blank");
            }
            user.setFullName(trimmed);
            user.setAvatarInitials(initialsOf(trimmed));
        }
        if (request.area() != null) {
            user.setArea(request.area().trim());
        }
        if (request.bio() != null) {
            user.setBio(request.bio().trim());
        }
        if (request.playStyle() != null) {
            user.setPlayStyle(SkillLevel.fromString(request.playStyle()));
        }
        if (request.playerRole() != null) {
            user.setPlayerRole(request.playerRole());
        }
        if (request.preferredSports() != null) {
            user.setPreferredSports(toCsv(request.preferredSports()));
        }
        if (request.preferredTimes() != null) {
            user.setPreferredTimes(toCsv(request.preferredTimes()));
        }
        if (request.position() != null) {
            user.setPreferredPosition(request.position().trim());
        }
        return toDto(users.save(user));
    }

    @Transactional(readOnly = true)
    public List<VenueSummaryDto> listSavedVenues(UUID publicId) {
        User user = requireUser(publicId);
        return savedVenues.findByIdUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(saved -> toVenueSummary(saved.getVenue()))
                .toList();
    }

    /** Bookmarks the venue if not saved, removes it otherwise. Returns the new state. */
    @Transactional
    public boolean toggleSavedVenue(UUID publicId, String venueSlug) {
        User user = requireUser(publicId);
        Venue venue = venues.findBySlug(venueSlug)
                .orElseThrow(() -> new com.turfchai.venue.service.VenueSearchService.VenueNotFoundException(venueSlug));

        return savedVenues.findByIdUserIdAndIdVenueId(user.getId(), venue.getId())
                .map(existing -> {
                    savedVenues.delete(existing);
                    return false;
                })
                .orElseGet(() -> {
                    try {
                        savedVenues.save(new SavedVenue(user, venue));
                    } catch (DataIntegrityViolationException e) {
                        // concurrent save already bookmarked it - same end state
                    }
                    return true;
                });
    }

    /** Atomic remove - no-op when the venue isn't bookmarked. */
    @Transactional
    public void removeSavedVenue(UUID publicId, String venueSlug) {
        User user = requireUser(publicId);
        venues.findBySlug(venueSlug).ifPresent(venue ->
                savedVenues.findByIdUserIdAndIdVenueId(user.getId(), venue.getId())
                        .ifPresent(savedVenues::delete));
    }

    @Transactional(readOnly = true)
    public boolean isSaved(UUID publicId, String venueSlug) {
        User user = requireUser(publicId);
        return venues.findBySlug(venueSlug)
                .map(venue -> savedVenues.existsByIdUserIdAndIdVenueId(user.getId(), venue.getId()))
                .orElse(false);
    }

    // ── helpers ──────────────────────────────────────────────────────

    private User requireUser(UUID publicId) {
        return users.findByPublicId(publicId.toString())
                .orElseThrow(() -> new UserNotFoundException(publicId));
    }

    private PlayerProfileDto toDto(User user) {
        return new PlayerProfileDto(
                UUID.fromString(user.getPublicId()), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getArea(), user.getBio(), user.getAvatarInitials(),
                user.getPlayStyle() == null ? null : user.getPlayStyle().name().toLowerCase(Locale.ROOT),
                user.getPlayerRole(), fromCsv(user.getPreferredSports()), fromCsv(user.getPreferredTimes()),
                user.getPreferredPosition(),
                user.getReliabilityScore(), user.getGamesAttended());
    }

    private VenueSummaryDto toVenueSummary(Venue venue) {
        SportPricingRule cheapest = venue.getPricingRules().stream()
                .filter(rule -> rule != null && rule.isActive())
                .min(Comparator.comparing((SportPricingRule rule) -> rule.getRate()))
                .orElse(null);
        List<String> sports = venue.getPitches().stream()
                .flatMap(pitch -> pitch.getSports().stream())
                .filter(Objects::nonNull)
                .map(sport -> sport.getSlug())
                .distinct()
                .toList();
        return new VenueSummaryDto(
                venue.getId(), venue.getSlug(), venue.getName(), venue.getArea(), venue.getAddress(),
                venue.getLat(), venue.getLng(),
                venue.getRatingAvg(), venue.getReviewCount(), venue.isVerified(), venue.getPromotionLabel(),
                fromCsv(venue.getAmenities()), sports,
                cheapest == null ? null : cheapest.getRate(),
                cheapest == null ? null : cheapest.getSlotDurationMin(),
                null,
                fromCsv(venue.getPhotos()));
    }

    private static String initialsOf(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (int i = 0; i < Math.min(parts.length, 2); i++) {
            initials.append(Character.toUpperCase(parts[i].charAt(0)));
        }
        return initials.toString();
    }

    private static String toCsv(List<String> values) {
        return values.stream()
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .filter(value -> !value.isEmpty())
                .distinct()
                .reduce((a, b) -> a + "," + b)
                .orElse("");
    }

    private static List<String> fromCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public static class UserNotFoundException extends RuntimeException {
        public UserNotFoundException(UUID publicId) {
            super("User not found: " + publicId);
        }
    }
}
