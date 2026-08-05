package com.turfchai.ai.llm;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FallbackLlmProviderTest {

    private static final LlmRequest REQUEST = new LlmRequest(List.of(ChatMessage.user("hi")), List.of());
    private static final Duration COOLDOWN = Duration.ofSeconds(60);

    private final AtomicLong nowMillis = new AtomicLong(0);
    private final Clock clock = new Clock() {
        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(nowMillis.get());
        }
    };

    private FallbackLlmProvider provider(LlmProvider primary, LlmProvider secondary) {
        return new FallbackLlmProvider(primary, secondary, COOLDOWN, clock);
    }

    private LlmProvider stub(String name, LlmResponse response) {
        return new LlmProvider() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                return response;
            }
        };
    }

    private LlmProvider failing(String name, LlmException failure, AtomicInteger calls) {
        return new LlmProvider() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                calls.incrementAndGet();
                throw failure;
            }
        };
    }

    @Test
    void usesPrimaryWhenHealthy() {
        AtomicInteger fallbackCalls = new AtomicInteger();
        FallbackLlmProvider provider = provider(
                stub("primary", LlmResponse.ofText("from primary")),
                failing("secondary", new LlmException("should not be called"), fallbackCalls));

        assertThat(provider.chat(REQUEST).text()).isEqualTo("from primary");
        assertThat(fallbackCalls.get()).isZero();
    }

    @Test
    void fallsBackOnRetryableFailure() {
        AtomicInteger primaryCalls = new AtomicInteger();
        FallbackLlmProvider provider = provider(
                failing("primary", new LlmException("quota exceeded", null, true), primaryCalls),
                stub("secondary", LlmResponse.ofText("from fallback")));

        assertThat(provider.chat(REQUEST).text()).isEqualTo("from fallback");
        assertThat(primaryCalls.get()).isEqualTo(1);
    }

    @Test
    void cooldownSkipsPrimaryAfterFailureThenRetriesAfterExpiry() {
        AtomicInteger primaryCalls = new AtomicInteger();
        FallbackLlmProvider provider = provider(
                failing("primary", new LlmException("quota exceeded", null, true), primaryCalls),
                stub("secondary", LlmResponse.ofText("from fallback")));

        provider.chat(REQUEST); // primary tried, fails, cooldown starts
        provider.chat(REQUEST); // within cooldown -> primary skipped
        provider.chat(REQUEST);
        assertThat(primaryCalls.get()).isEqualTo(1);

        nowMillis.set(COOLDOWN.toMillis() + 1); // cooldown expired
        provider.chat(REQUEST);
        assertThat(primaryCalls.get()).isEqualTo(2); // primary retried
    }

    @Test
    void primaryTriedAsLastResortWhenSecondaryFailsDuringCooldown() {
        AtomicInteger primaryCalls = new AtomicInteger();
        LlmProvider flakySecondary = new LlmProvider() {
            int calls = 0;

            @Override
            public String name() {
                return "secondary";
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                if (++calls > 1)
                    throw new LlmException("secondary down", null, true);
                return LlmResponse.ofText("ok");
            }
        };
        LlmProvider recoveringPrimary = new LlmProvider() {
            @Override
            public String name() {
                return "primary";
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                if (primaryCalls.incrementAndGet() == 1)
                    throw new LlmException("quota", null, true);
                return LlmResponse.ofText("primary recovered");
            }
        };
        FallbackLlmProvider provider = provider(recoveringPrimary, flakySecondary);

        provider.chat(REQUEST); // primary fails -> secondary ok, cooldown on
        assertThat(provider.chat(REQUEST).text()) // secondary fails -> primary last resort
                .isEqualTo("primary recovered");
    }

    @Test
    void doesNotFallBackOnNonRetryableFailure() {
        AtomicInteger fallbackCalls = new AtomicInteger();
        FallbackLlmProvider provider = provider(
                failing("primary", new LlmException("prompt blocked", null, false), new AtomicInteger()),
                failing("secondary", new LlmException("unused"), fallbackCalls));

        assertThatThrownBy(() -> provider.chat(REQUEST))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("prompt blocked");
        assertThat(fallbackCalls.get()).isZero();
    }

    @Test
    void bothFailingPropagatesFallbackErrorWithPrimarySuppressed() {
        FallbackLlmProvider provider = provider(
                failing("primary", new LlmException("primary down", null, true), new AtomicInteger()),
                failing("secondary", new LlmException("secondary down", null, true), new AtomicInteger()));

        assertThatThrownBy(() -> provider.chat(REQUEST))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("secondary down")
                .satisfies(e -> assertThat(e.getSuppressed())
                        .anySatisfy(s -> assertThat(s.getMessage()).contains("primary down")));
    }

    @Test
    void nameCombinesBothProviders() {
        FallbackLlmProvider provider = provider(
                stub("gemini", LlmResponse.ofText("x")),
                stub("huggingface", LlmResponse.ofText("y")));
        assertThat(provider.name()).isEqualTo("gemini+huggingface");
    }
}
