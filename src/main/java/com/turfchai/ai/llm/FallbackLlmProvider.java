package com.turfchai.ai.llm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Delegates to the primary provider and falls back to the secondary when
 * the primary fails with a <em>retryable</em> error (transport failure,
 * HTTP 429 quota exhaustion, 5xx). Non-retryable errors — e.g. a
 * safety-blocked prompt — propagate unchanged, since another provider
 * would not fix them.
 */
public class FallbackLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(FallbackLlmProvider.class);

    private final LlmProvider primary;
    private final LlmProvider secondary;

    public FallbackLlmProvider(LlmProvider primary, LlmProvider secondary) {
        this.primary = primary;
        this.secondary = secondary;
    }

    @Override
    public String name() {
        return primary.name() + "+" + secondary.name();
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        try {
            return primary.chat(request);
        } catch (LlmException e) {
            if (!e.isRetryable()) {
                throw e;
            }
            log.warn("Primary LLM '{}' failed ({}); falling back to '{}'",
                    primary.name(), e.getMessage(), secondary.name());
            try {
                return secondary.chat(request);
            } catch (LlmException fallbackFailure) {
                fallbackFailure.addSuppressed(e);
                throw fallbackFailure;
            }
        }
    }
}
