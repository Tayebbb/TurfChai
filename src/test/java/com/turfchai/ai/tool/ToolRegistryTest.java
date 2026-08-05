package com.turfchai.ai.tool;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ToolRegistryTest {

    private static final ToolContext CTX = new ToolContext("s1", "u1");

    private Tool tool(String name, ToolResult result) {
        return new Tool() {
            @Override
            public ToolSpec spec() {
                return new ToolSpec(name, "test tool", List.of());
            }

            @Override
            public ToolResult execute(Map<String, Object> args, ToolContext ctx) {
                return result;
            }
        };
    }

    @Test
    void executesRegisteredTool() {
        ToolRegistry registry = new ToolRegistry(List.of(tool("echo", ToolResult.ok("hi"))));
        ToolResult result = registry.execute("echo", Map.of(), CTX);
        assertThat(result.success()).isTrue();
        assertThat(result.data()).isEqualTo("hi");
    }

    @Test
    void unknownToolReturnsFailureNotThrow() {
        ToolRegistry registry = new ToolRegistry(List.of());
        ToolResult result = registry.execute("nope", Map.of(), CTX);
        assertThat(result.success()).isFalse();
        assertThat(result.error()).contains("Unknown tool");
    }

    @Test
    void throwingToolIsConvertedToFailure() {
        Tool bomb = new Tool() {
            @Override
            public ToolSpec spec() {
                return new ToolSpec("bomb", "explodes", List.of());
            }

            @Override
            public ToolResult execute(Map<String, Object> args, ToolContext ctx) {
                throw new IllegalStateException("boom");
            }
        };
        ToolRegistry registry = new ToolRegistry(List.of(bomb));
        ToolResult result = registry.execute("bomb", Map.of(), CTX);
        assertThat(result.success()).isFalse();
        assertThat(result.error()).contains("boom");
    }

    @Test
    void duplicateRegistrationIsRejected() {
        assertThatThrownBy(() -> new ToolRegistry(List.of(
                tool("dup", ToolResult.ok(1)), tool("dup", ToolResult.ok(2)))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void specsCanBeScopedByAllowList() {
        ToolRegistry registry = new ToolRegistry(List.of(
                tool("a", ToolResult.ok(1)), tool("b", ToolResult.ok(2))));
        assertThat(registry.specs(List.of("a"))).extracting(ToolSpec::name).containsExactly("a");
    }
}
