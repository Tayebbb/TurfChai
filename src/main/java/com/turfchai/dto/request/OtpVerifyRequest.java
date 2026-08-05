package com.turfchai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record OtpVerifyRequest(
        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^\\+?[0-9\\s\\-()]{7,20}$", message = "A valid phone number is required")
        String phone,

        @NotBlank(message = "OTP code is required")
        @Size(min = 4, max = 6, message = "OTP code must be 4 to 6 digits")
        String code,

        @Size(max = 100, message = "Full name must be at most 100 characters")
        String fullName,

        @Pattern(regexp = "PLAYER|SOLO_PLAYER|HOST|OWNER", message = "Invalid role")
        String role
) {
}
