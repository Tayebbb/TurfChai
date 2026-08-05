package com.turfchai.ai.llm;

import java.util.List;

/**
 * Provider-agnostic chat response: either final {@code text} or one or more
 * {@code toolCalls} the agent must execute before calling the model again.
 */
public record LlmResponse(String text, List<ToolCall> toolCalls, TokenUsage usage) {

    public LlmResponse {
        toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
        usage = usage == null ? TokenUsage.UNKNOWN : usage;
    }

    public static LlmResponse ofText(String text) {
        return new LlmResponse(text, List.of(), TokenUsage.UNKNOWN);
    }

    public static LlmResponse ofToolCalls(List<ToolCall> calls) {
        return new LlmResponse(null, calls, TokenUsage.UNKNOWN);
    }

    public boolean hasToolCalls() {
        return !toolCalls.isEmpty();
    }
}
