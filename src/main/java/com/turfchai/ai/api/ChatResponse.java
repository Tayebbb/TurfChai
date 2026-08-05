package com.turfchai.ai.api;

import java.util.List;

public record ChatResponse(
        String sessionId,
        String reply,
        String intent,
        List<String> toolsUsed,
        long latencyMs) {
}
