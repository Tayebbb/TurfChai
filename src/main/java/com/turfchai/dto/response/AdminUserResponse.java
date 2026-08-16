package com.turfchai.dto.response;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;

import java.time.OffsetDateTime;

/**
 * Admin console view of a user account.
 *
 * <p>
 * Exists so the admin API stops publishing the {@code User} entity directly.
 * Password hash, 2FA secret and lockout counters are {@code @JsonIgnore}d on
 * the
 * entity today, but that makes the contract depend on an annotation nobody sees
 * when adding a column — an explicit projection cannot leak a field that was
 * never listed here.
 */
public record AdminUserResponse(
        Long id,
        String publicId,
        String fullName,
        String email,
        String phone,
        RoleType role,
        String status,
        Boolean isSuspended,
        Boolean twoFactorEnabled,
        String area,
        String avatarUrl,
        String avatarInitials,
        String bio,
        Integer reliabilityScore,
        Integer gamesAttended,
        Integer gamesNoShow,
        SkillLevel playStyle,
        String playerRole,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static AdminUserResponse from(User user) {
        if (user == null) {
            return null;
        }
        return new AdminUserResponse(
                user.getId(),
                user.getPublicId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.getStatus(),
                user.getIsSuspended(),
                user.getTwoFactorEnabled(),
                user.getArea(),
                user.getAvatarUrl(),
                user.getAvatarInitials(),
                user.getBio(),
                user.getReliabilityScore(),
                user.getGamesAttended(),
                user.getGamesNoShow(),
                user.getPlayStyle(),
                user.getPlayerRole(),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
