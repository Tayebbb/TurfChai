package com.turfchai.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

public record UpdateAdminPermissionsRequest(
        @NotEmpty(message = "Permissions cannot be empty")
        Map<String, Object> permissions
) {
}