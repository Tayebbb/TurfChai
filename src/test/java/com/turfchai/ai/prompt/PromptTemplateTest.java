package com.turfchai.ai.prompt;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PromptTemplateTest {

    @Test
    void rendersPlaceholders() {
        String out = PromptTemplate.render("Hello {{name}}, welcome to {{place}}!",
                Map.of("name", "Rafi", "place", "TurfChai"));
        assertThat(out).isEqualTo("Hello Rafi, welcome to TurfChai!");
    }

    @Test
    void failsOnMissingVariable() {
        assertThatThrownBy(() -> PromptTemplate.render("Hi {{name}}", Map.of()))
                .isInstanceOf(PromptException.class)
                .hasMessageContaining("name");
    }

    @Test
    void leavesTextWithoutPlaceholdersUntouched() {
        assertThat(PromptTemplate.render("plain text", Map.of())).isEqualTo("plain text");
    }
}
