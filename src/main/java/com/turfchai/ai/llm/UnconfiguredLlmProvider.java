package com.turfchai.ai.llm;

/**
 * Fallback provider used when no API key is configured. Lets the
 * application boot normally; chat requests fail fast with a clear message
 * that the API layer maps to HTTP 503.
 */
public class UnconfiguredLlmProvider implements LlmProvider {

    @Override
    public String name() {
        return "unconfigured";
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        throw new LlmException("No LLM provider is configured. Set app.ai.gemini.api-key.");
    }
}
