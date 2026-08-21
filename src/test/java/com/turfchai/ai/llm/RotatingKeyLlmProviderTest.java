package com.turfchai.ai.llm;

import com.turfchai.ai.config.AiProperties;
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

class RotatingKeyLlmProviderTest {

    private static final LlmRequest REQUEST = new LlmRequest(List.of(ChatMessage.user("hi")), List.of());
    private static final Duration COOLDOWN = Duration.ofSeconds(60);

    private final AtomicLong nowMillis = new AtomicLong(1000);
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

    private LlmProvider stub(String name, String reply, AtomicInteger callCounter) {
        return new LlmProvider() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                if (callCounter != null) {
                    callCounter.incrementAndGet();
                }
                return LlmResponse.ofText(reply);
            }
        };
    }

    private LlmProvider failing(String name, LlmException failure, AtomicInteger callCounter) {
        return new LlmProvider() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public LlmResponse chat(LlmRequest request) {
                if (callCounter != null) {
                    callCounter.incrementAndGet();
                }
                throw failure;
            }
        };
    }

    @Test
    void usesFirstKeyWhenHealthy() {
        AtomicInteger calls1 = new AtomicInteger();
        AtomicInteger calls2 = new AtomicInteger();

        LlmProvider k1 = stub("key1", "reply from key1", calls1);
        LlmProvider k2 = stub("key2", "reply from key2", calls2);

        RotatingKeyLlmProvider provider = new RotatingKeyLlmProvider("openrouter", List.of(k1, k2), COOLDOWN.toMillis(), clock);

        LlmResponse res = provider.chat(REQUEST);
        assertThat(res.text()).isEqualTo("reply from key1");
        assertThat(calls1.get()).isEqualTo(1);
        assertThat(calls2.get()).isEqualTo(0);
    }

    @Test
    void rotatesToSecondKeyWhenFirstHitsQuotaLimit() {
        AtomicInteger calls1 = new AtomicInteger();
        AtomicInteger calls2 = new AtomicInteger();

        LlmProvider k1 = failing("key1", new LlmException("HTTP 429 Rate limit exceeded", null, true), calls1);
        LlmProvider k2 = stub("key2", "reply from key2", calls2);

        RotatingKeyLlmProvider provider = new RotatingKeyLlmProvider("openrouter", List.of(k1, k2), COOLDOWN.toMillis(), clock);

        LlmResponse res = provider.chat(REQUEST);
        assertThat(res.text()).isEqualTo("reply from key2");
        assertThat(calls1.get()).isEqualTo(1);
        assertThat(calls2.get()).isEqualTo(1);

        // Next request immediately skips key1 (in cooldown) and hits key2 directly
        provider.chat(REQUEST);
        assertThat(calls1.get()).isEqualTo(1);
        assertThat(calls2.get()).isEqualTo(2);
    }

    @Test
    void rotatesAcrossMultipleExhaustedKeys() {
        AtomicInteger calls1 = new AtomicInteger();
        AtomicInteger calls2 = new AtomicInteger();
        AtomicInteger calls3 = new AtomicInteger();

        LlmProvider k1 = failing("key1", new LlmException("HTTP 429 quota exhausted", null, true), calls1);
        LlmProvider k2 = failing("key2", new LlmException("HTTP 402 payment required", null, true), calls2);
        LlmProvider k3 = stub("key3", "reply from key3", calls3);

        RotatingKeyLlmProvider provider = new RotatingKeyLlmProvider("openrouter", List.of(k1, k2, k3), COOLDOWN.toMillis(), clock);

        LlmResponse res = provider.chat(REQUEST);
        assertThat(res.text()).isEqualTo("reply from key3");
        assertThat(calls1.get()).isEqualTo(1);
        assertThat(calls2.get()).isEqualTo(1);
        assertThat(calls3.get()).isEqualTo(1);
    }

    @Test
    void throwsWhenAllKeysExhausted() {
        LlmProvider k1 = failing("key1", new LlmException("HTTP 429 key 1", null, true), null);
        LlmProvider k2 = failing("key2", new LlmException("HTTP 429 key 2", null, true), null);

        RotatingKeyLlmProvider provider = new RotatingKeyLlmProvider("openrouter", List.of(k1, k2), COOLDOWN.toMillis(), clock);

        assertThatThrownBy(() -> provider.chat(REQUEST))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("HTTP 429 key 2");
    }

    @Test
    void nonRetryableErrorDoesNotRotate() {
        AtomicInteger calls1 = new AtomicInteger();
        AtomicInteger calls2 = new AtomicInteger();

        LlmProvider k1 = failing("key1", new LlmException("Prompt blocked by safety", null, false), calls1);
        LlmProvider k2 = stub("key2", "reply from key2", calls2);

        RotatingKeyLlmProvider provider = new RotatingKeyLlmProvider("openrouter", List.of(k1, k2), COOLDOWN.toMillis(), clock);

        assertThatThrownBy(() -> provider.chat(REQUEST))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("Prompt blocked by safety");

        assertThat(calls1.get()).isEqualTo(1);
        assertThat(calls2.get()).isEqualTo(0);
    }

    @Test
    void effectiveApiKeysSplitsAndDeduplicates() {
        AiProperties.Endpoint endpoint = new AiProperties.Endpoint();
        endpoint.setApiKey("sk-key1");
        endpoint.setApiKeys(List.of("sk-key2, sk-key3", "sk-key1", "  sk-key4  ", ""));

        List<String> effective = endpoint.getEffectiveApiKeys();
        assertThat(effective).containsExactly("sk-key1", "sk-key2", "sk-key3", "sk-key4");
    }
}
