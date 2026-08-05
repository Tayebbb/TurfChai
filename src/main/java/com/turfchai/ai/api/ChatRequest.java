package com.turfchai.ai.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Chat request. {@code userId} is temporary — it will come from the security
 * principal once authentication is integrated. Until then the controller
 * binds each session to the first userId that used it.
 */
public record ChatRequest(
        @Size(max = 64) @Pattern(regexp = "[A-Za-z0-9_-]*") String sessionId,
        @NotBlank @Size(max = 2000) String message,
        @Size(max = 64) @Pattern(regexp = "[A-Za-z0-9_-]*") String userId) {
}
