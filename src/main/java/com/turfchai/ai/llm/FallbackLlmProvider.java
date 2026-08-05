package com.turfchai.ai.llm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Duration;

/**
 * Delegates to the primary provider and falls back to the secondary when
 * the primary fails with a <em>retryable</em> error (transport failure,
 * HTTP 429 quota exhaustion, 5xx). Non-retryable errors — e.g. a
 * safety-blocked prompt — propagate unchanged, since another provider
 * would not fix them.
 *
 * <p>A cooldown circuit breaker skips the primary entirely for a period
 * after it fails, avoiding a slow doomed round trip on every request while
 * a quota is exhausted. If the secondary fails during cooldown, the primary
 * is still tried as a last resort.
 */
public class FallbackLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(FallbackLlmProvider.class);

    private final LlmProvider primary;
    private final LlmProvider secondary;
    private final long cooldownMillis;
    private final Clock clock;

    private volatile long skipPrimaryUntil = 0;

    public FallbackLlmProvider(LlmProvider primary, LlmProvider secondary,
                               Duration cooldown, Clock clock) {
        this.primary = primary;
        this.secondary = secondary;
        this.cooldownMillis = cooldown.toMillis();
        this.clock = clock;
    }

    @Override
    public String name() {
        return primary.name() + "+" + secondary.name();
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        if (clock.millis() < skipPrimaryUntil) {
            return chatSecondaryThenPrimaryLastResort(request);
        }
        try {
            return primary.chat(request);
        } catch (LlmException e) {
            if (!e.isRetryable()) {
                throw e;
            }
            skipPrimaryUntil = clock.millis() + cooldownMillis;
            log.warn("Primary LLM '{}' failed ({}); falling back to '{}' and cooling primary for {} ms",
                    primary.name(), e.getMessage(), secondary.name(), cooldownMillis);
            try {
                return secondary.chat(request);
            } catch (LlmException fallbackFailure) {
                fallbackFailure.addSuppressed(e);
                throw fallbackFailure;
            }
        }
    }

    private LlmResponse chatSecondaryThenPrimaryLastResort(LlmRequest request) {
        try {
            return secondary.chat(request);
        } catch (LlmException secondaryFailure) {
            log.warn("Secondary LLM '{}' failed during primary cooldown; trying primary as last resort",
                    secondary.name());
            try {
                return primary.chat(request);
            } catch (LlmException primaryFailure) {
                skipPrimaryUntil = clock.millis() + cooldownMillis;
                primaryFailure.addSuppressed(secondaryFailure);
                throw primaryFailure;
            }
        }
    }
}
