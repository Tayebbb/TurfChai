package com.turfchai.ai.llm;

import com.turfchai.ai.tool.ToolSpec;

import java.util.List;

/**
 * Provider-agnostic chat request. {@code tools} may be empty when the
 * planner decides the model must answer without function calling.
 */
public record LlmRequest(List<ChatMessage> messages, List<ToolSpec> tools) {

    public LlmRequest {
        messages = List.copyOf(messages);
        tools = tools == null ? List.of() : List.copyOf(tools);
    }
}
