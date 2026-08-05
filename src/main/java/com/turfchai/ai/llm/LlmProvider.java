package com.turfchai.ai.llm;

/**
 * Abstraction over any chat-completion LLM. Implementations must be
 * stateless and thread-safe; conversation state lives in the memory module.
 */
public interface LlmProvider {

    /** Human-readable provider id, e.g. {@code gemini}. */
    String name();

    /**
     * Executes one chat completion.
     *
     * @throws LlmException on transport, auth or provider errors
     */
    LlmResponse chat(LlmRequest request);
}
