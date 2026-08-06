package com.turfchai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record OtpRequest(
        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^\\+?[0-9\\s\\-()]{7,20}$", message = "A valid phone number is required")
        String phone
) {
}
