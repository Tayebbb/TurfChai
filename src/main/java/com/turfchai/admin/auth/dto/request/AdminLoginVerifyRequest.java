package com.turfchai.admin.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AdminLoginVerifyRequest(
                @NotBlank(message = "Challenge is required") String challenge,

                @NotBlank(message = "Verification code is required") @Pattern(regexp = "^[0-9]{6}$", message = "Verification code must be 6 digits") String code) {
}