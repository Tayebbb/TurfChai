package com.turfchai.ai.llm;

import java.util.Map;

/**
 * A tool invocation requested by the model. {@code thoughtSignature} is an
 * opaque token some Gemini models attach to function calls; it must be
 * echoed back when the call is replayed in conversation history.
 */
public record ToolCall(String name, Map<String, Object> arguments, String thoughtSignature) {

    public ToolCall(String name, Map<String, Object> arguments) {
        this(name, arguments, null);
    }
}
