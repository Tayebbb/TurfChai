package com.turfchai.player.dto;

import java.util.List;
import java.util.UUID;

/** Profile payload for the signed-in player. */
public record PlayerProfileDto(
        UUID id,
        String fullName,
        String email,
        String phone,
        String area,
        String bio,
        String avatarInitials,
        String playStyle,
        String playerRole,
        List<String> preferredSports,
        List<String> preferredTimes,
        Integer reliabilityScore,
        Integer gamesAttended) {
}
