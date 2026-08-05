package com.turfchai.dto.response;

import com.turfchai.model.enums.AdminRole;
import com.turfchai.model.enums.AdminStatus;

import java.time.OffsetDateTime;
import java.util.Map;

public record AdminResponse(
        Long id,
        Long userId,
        String fullName,
        String email,
        String avatarInitials,
        AdminRole adminRole,
        AdminStatus status,
        Map<String, Object> permissions,
        String appointedByName,
        OffsetDateTime appointedAt,
        OffsetDateTime lastActiveAt,
        boolean isSelf
) {
}