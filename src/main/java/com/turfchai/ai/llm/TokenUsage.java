package com.turfchai.ai.llm;

public record TokenUsage(int promptTokens, int completionTokens) {

    public static final TokenUsage UNKNOWN = new TokenUsage(0, 0);

    public int total() {
        return promptTokens + completionTokens;
    }
}
