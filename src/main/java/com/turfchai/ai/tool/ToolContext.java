package com.turfchai.ai.tool;

/**
 * Per-request execution context passed to every tool. Carries identity so
 * real implementations can enforce authorization at the service layer.
 */
public record ToolContext(String sessionId, String userId) {
}
