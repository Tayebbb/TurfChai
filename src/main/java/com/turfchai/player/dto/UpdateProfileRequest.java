package com.turfchai.player.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Partial profile update — null fields are left unchanged. */
public record UpdateProfileRequest(
        @Size(min = 2, max = 100) String fullName,
        @Size(max = 100) String area,
        @Size(max = 500) String bio,
        @Pattern(regexp = "beginner|intermediate|advanced", message = "must be beginner, intermediate or advanced")
        String playStyle,
        @Pattern(regexp = "captain|solo", message = "must be captain or solo")
        String playerRole,
        @Size(max = 10) List<@Size(max = 30) String> preferredSports,
        @Size(max = 10) List<@Size(max = 30) String> preferredTimes) {
}
