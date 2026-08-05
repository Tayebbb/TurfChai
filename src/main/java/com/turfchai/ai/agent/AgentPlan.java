package com.turfchai.ai.agent;

import java.util.List;

/** What the planner decided for one user message. */
public record AgentPlan(Intent intent, boolean useRetrieval, List<String> allowedTools) {

    public AgentPlan {
        allowedTools = allowedTools == null ? List.of() : List.copyOf(allowedTools);
    }
}
