package com.turfchai.ai.prompt;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PromptBuilderTest {

    private final PromptBuilder builder = new PromptBuilder(new PromptLoader());

    @Test
    void systemPromptContainsAllLayers() {
        String prompt = builder.buildSystemPrompt(null);
        assertThat(prompt)
                .contains("TurfChai")               // system
                .contains("Safety Rules")           // safety
                .contains("Booking Assistant")      // role
                .contains("Tool Usage");            // tool guidance
    }

    @Test
    void toolGuidanceOmittedWhenNoToolsExposed() {
        String prompt = builder.buildSystemPrompt(null, false);
        assertThat(prompt)
                .contains("Safety Rules")
                .doesNotContain("Tool Usage");
    }

    @Test
    void systemPromptIncludesStateWhenPresent() {
        String prompt = builder.buildSystemPrompt("sport=football, date=2026-08-10");
        assertThat(prompt).contains("Current booking context")
                .contains("sport=football");
    }

    @Test
    void systemPromptOmitsStateSectionWhenBlank() {
        assertThat(builder.buildSystemPrompt("")).doesNotContain("Current booking context");
    }

    @Test
    void retrievalContextWrapsChunks() {
        String context = builder.buildRetrievalContext("Refunds take 3-5 days.");
        assertThat(context).contains("Refunds take 3-5 days.")
                .contains("ONLY this information");
    }

    @Test
    void missingPromptResourceFailsLoudly() {
        assertThatThrownBy(() -> new PromptLoader().load("does-not-exist"))
                .isInstanceOf(PromptException.class);
    }
}
