package com.turfchai.ai.agent;

import java.util.List;

/** Final result of one agent turn, plus observability metadata. */
public record AgentResponse(
        String reply,
        Intent intent,
        List<String> toolsInvoked,
        boolean usedRetrieval,
        long latencyMs,
        int totalTokens) {
}
