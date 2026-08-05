package com.turfchai.ai.api;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class SimpleRateLimiterTest {

    /** Mutable test clock. */
    private static Clock tickingClock(AtomicLong millis) {
        return new Clock() {
            @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override public Instant instant() { return Instant.ofEpochMilli(millis.get()); }
        };
    }

    @Test
    void allowsUpToLimitThenRejects() {
        AtomicLong now = new AtomicLong(0);
        SimpleRateLimiter limiter = new SimpleRateLimiter(3, 1000, tickingClock(now));

        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isFalse();
    }

    @Test
    void windowResetsAfterExpiry() {
        AtomicLong now = new AtomicLong(0);
        SimpleRateLimiter limiter = new SimpleRateLimiter(1, 1000, tickingClock(now));

        assertThat(limiter.tryAcquire("k")).isTrue();
        assertThat(limiter.tryAcquire("k")).isFalse();
        now.set(1500);
        assertThat(limiter.tryAcquire("k")).isTrue();
    }

    @Test
    void keysAreIndependent() {
        AtomicLong now = new AtomicLong(0);
        SimpleRateLimiter limiter = new SimpleRateLimiter(1, 1000, tickingClock(now));

        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("b")).isTrue();
    }
}
