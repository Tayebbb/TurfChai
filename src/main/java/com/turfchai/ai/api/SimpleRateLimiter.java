package com.turfchai.ai.api;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Minimal fixed-window rate limiter to stop cost-DoS against paid LLM
 * calls. Per-key (session or IP), in-memory; replace with a gateway/Redis
 * limiter for multi-instance deploys.
 */
public class SimpleRateLimiter {

    private record Window(long startMillis, AtomicInteger count) { }

    private final int maxRequests;
    private final long windowMillis;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public SimpleRateLimiter(int maxRequests, long windowMillis, Clock clock) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    public boolean tryAcquire(String key) {
        long now = clock.millis();
        Window window = windows.compute(key, (k, existing) ->
                existing == null || now - existing.startMillis() >= windowMillis
                        ? new Window(now, new AtomicInteger(0))
                        : existing);
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> now - e.getValue().startMillis() >= windowMillis);
        }
        return window.count().incrementAndGet() <= maxRequests;
    }
}
