package com.turfchai.ai.tool;

/**
 * A single tool parameter, described in a JSON-Schema-compatible way so any
 * LLM provider can translate it into its native function-declaration format.
 */
public record ToolParam(String name, String type, String description, boolean required) {

    public static ToolParam required(String name, String type, String description) {
        return new ToolParam(name, type, description, true);
    }

    public static ToolParam optional(String name, String type, String description) {
        return new ToolParam(name, type, description, false);
    }
}
