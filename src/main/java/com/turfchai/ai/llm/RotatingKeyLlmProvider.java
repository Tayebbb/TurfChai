package com.turfchai.ai.llm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Wraps a list of {@link LlmProvider} instances (one per API key) and
 * automatically rotates to the next when a key is exhausted (HTTP 429/402).
 *
 * <p>
 * Exhausted keys are not retried for {@code cooldownMillis} so every request
 * doesn't waste time on a known-dead key. Once all keys are exhausted the
 * exception from the last key is re-thrown; the controller maps this to a 503.
 *
 * <p>
 * Thread-safe: rotation index advances atomically and each delegate provider
 * is itself stateless.
 */
public class RotatingKeyLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(RotatingKeyLlmProvider.class);

    private final String providerName;
    private final List<LlmProvider> delegates;
    private final long cooldownMillis;
    private final Clock clock;

    /** Per-key expiry timestamp: 0 means the key is ready to use. */
    private final AtomicLong[] exhaustedUntil;

    public RotatingKeyLlmProvider(String providerName,
            List<LlmProvider> delegates,
            long cooldownMillis,
            Clock clock) {
        if (delegates == null || delegates.isEmpty()) {
            throw new IllegalArgumentException("At least one delegate provider is required");
        }
        this.providerName = providerName;
        this.delegates = delegates;
        this.cooldownMillis = cooldownMillis;
        this.clock = clock;
        this.exhaustedUntil = new AtomicLong[delegates.size()];
        for (int i = 0; i < delegates.size(); i++) {
            exhaustedUntil[i] = new AtomicLong(0);
        }
    }

    @Override
    public String name() {
        return providerName + "[" + delegates.size() + " keys]";
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        long now = clock.millis();
        LlmException lastException = null;

        for (int i = 0; i < delegates.size(); i++) {
            // Skip keys still in cooldown
            if (exhaustedUntil[i].get() > now) {
                continue;
            }
            try {
                LlmResponse response = delegates.get(i).chat(request);
                // On success, make sure the key is no longer marked as exhausted
                // (daily quotas reset overnight, so a key that was exhausted
                // yesterday might work fine now).
                exhaustedUntil[i].set(0);
                return response;
            } catch (LlmException e) {
                lastException = e;
                if (e.isRetryable()) {
                    // Mark this key as exhausted and try the next one
                    exhaustedUntil[i].set(clock.millis() + cooldownMillis);
                    log.warn("Key #{} of {} for '{}' is exhausted ({}); rotating to next key.",
                            i + 1, delegates.size(), providerName, e.getMessage());
                } else {
                    // Non-retryable (e.g. bad request, safety filter) — don't rotate
                    throw e;
                }
            }
        }

        // All keys are exhausted
        log.error("All {} keys for '{}' are exhausted or failing.", delegates.size(), providerName);
        if (lastException != null) {
            throw lastException;
        }
        throw new LlmException(providerName + ": all " + delegates.size() + " keys are exhausted", null, true);
    }
}
