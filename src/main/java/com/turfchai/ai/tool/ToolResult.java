package com.turfchai.ai.tool;

/**
 * Outcome of a tool execution. {@code data} must be a Jackson-serializable
 * structure (maps/lists/records) — it is rendered to JSON and fed back to
 * the model, never exposed to the user directly.
 */
public record ToolResult(boolean success, Object data, String error) {

    public static ToolResult ok(Object data) {
        return new ToolResult(true, data, null);
    }

    public static ToolResult fail(String error) {
        return new ToolResult(false, null, error);
    }
}
