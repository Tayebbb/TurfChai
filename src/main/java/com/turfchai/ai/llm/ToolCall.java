package com.turfchai.ai.llm;

import java.util.Map;

/** A tool invocation requested by the model. */
public record ToolCall(String name, Map<String, Object> arguments) {
}
