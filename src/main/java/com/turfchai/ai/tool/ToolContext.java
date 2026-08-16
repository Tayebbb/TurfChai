package com.turfchai.ai.tool;

/**
 * Per-request execution context passed to every tool.
 *
 * <p>
 * {@code authenticatedUserId} is the <em>only</em> identity a tool may trust to
 * scope a database read: it comes from the JWT principal the security filter
 * verified. {@code userId} is a conversation label that an anonymous visitor
 * supplies in the request body, so using it to look up bookings, payments or a
 * profile would let any caller read another account by naming it.
 */
public record ToolContext(String sessionId, String userId, Long authenticatedUserId) {

    /** Anonymous session — the caller has no verified identity. */
    public ToolContext(String sessionId, String userId) {
        this(sessionId, userId, null);
    }

    public boolean isAuthenticated() {
        return authenticatedUserId != null;
    }
}
