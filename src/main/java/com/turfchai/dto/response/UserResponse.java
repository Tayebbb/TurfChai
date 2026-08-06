package com.turfchai.dto.response;

import com.turfchai.model.enums.RoleType;

import java.time.OffsetDateTime;

public record UserResponse(
        Long id,
        String publicId,
        String fullName,
        String email,
        String phone,
        RoleType role,
        String status,
        String area,
        String avatarUrl,
        String avatarInitials,
        String bio,
        Integer reliabilityScore,
        OffsetDateTime createdAt
) {
}
