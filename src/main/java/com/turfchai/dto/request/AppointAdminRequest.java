package com.turfchai.dto.request;

import com.turfchai.model.enums.AdminRole;
import jakarta.validation.constraints.*;

import java.util.Map;

public record AppointAdminRequest(
        @NotBlank(message = "Full name is required")
        @Size(max = 100, message = "Full name must be at most 100 characters")
        String fullName,

        @NotBlank(message = "Work email is required")
        @Email(message = "A valid email is required")
        @Size(max = 150, message = "Email must be at most 150 characters")
        String email,

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^\\+?[0-9\\s\\-()]{7,20}$", message = "A valid phone number is required")
        String phone,

        @NotBlank(message = "Temporary password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String temporaryPassword,

        @NotNull(message = "Admin role is required")
        AdminRole adminRole,

        Map<String, Object> permissions
) {
}