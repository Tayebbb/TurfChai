package com.turfchai.ai.llm;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FallbackLlmProviderTest {

    private static final LlmRequest REQUEST = new LlmRequest(List.of(ChatMessage.user("hi")), List.of());

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
        FallbackLlmProvider provider = new FallbackLlmProvider(
                stub("primary", LlmResponse.ofText("from primary")),
                failing("secondary", new LlmException("should not be called"), fallbackCalls));

        assertThat(provider.chat(REQUEST).text()).isEqualTo("from primary");
        assertThat(fallbackCalls.get()).isZero();
    }

    @Test
    void fallsBackOnRetryableFailure() {
        AtomicInteger primaryCalls = new AtomicInteger();
        FallbackLlmProvider provider = new FallbackLlmProvider(
                failing("primary", new LlmException("quota exceeded", null, true), primaryCalls),
                stub("secondary", LlmResponse.ofText("from fallback")));

        assertThat(provider.chat(REQUEST).text()).isEqualTo("from fallback");
        assertThat(primaryCalls.get()).isEqualTo(1);
    }

    @Test
    void doesNotFallBackOnNonRetryableFailure() {
        AtomicInteger fallbackCalls = new AtomicInteger();
        FallbackLlmProvider provider = new FallbackLlmProvider(
                failing("primary", new LlmException("prompt blocked", null, false), new AtomicInteger()),
                failing("secondary", new LlmException("unused"), fallbackCalls));

        assertThatThrownBy(() -> provider.chat(REQUEST))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("prompt blocked");
        assertThat(fallbackCalls.get()).isZero();
    }

    @Test
    void bothFailingPropagatesFallbackErrorWithPrimarySuppressed() {
        FallbackLlmProvider provider = new FallbackLlmProvider(
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
        FallbackLlmProvider provider = new FallbackLlmProvider(
                stub("gemini", LlmResponse.ofText("x")),
                stub("huggingface", LlmResponse.ofText("y")));
        assertThat(provider.name()).isEqualTo("gemini+huggingface");
    }
}
