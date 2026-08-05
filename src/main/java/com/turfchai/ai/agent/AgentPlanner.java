package com.turfchai.ai.agent;

import java.util.List;

/**
 * Maps intent to an execution plan: whether to run RAG retrieval and which
 * tools the model may call. Scoping tools per intent reduces token cost and
 * limits the blast radius of prompt-injection attempts.
 */
public class AgentPlanner {

    private static final List<String> BOOKING_TOOLS = List.of("search_venues", "manage_booking",
            "update_booking_context");
    private static final List<String> ALL_TOOLS = List.of("search_venues", "manage_booking", "update_booking_context",
            "get_user_profile", "get_payment_status", "search_tournaments");

    public AgentPlan plan(Intent intent) {
        return switch (intent) {
            case POLICY_QUESTION -> new AgentPlan(intent, true, List.of());
            case VENUE_SEARCH -> new AgentPlan(intent, false, BOOKING_TOOLS);
            case BOOKING -> new AgentPlan(intent, false, BOOKING_TOOLS);
            case PAYMENT -> new AgentPlan(intent, true, List.of("get_payment_status", "manage_booking"));
            case TOURNAMENT -> new AgentPlan(intent, true, List.of("search_tournaments"));
            case PROFILE -> new AgentPlan(intent, true, List.of("get_user_profile"));
            case SMALL_TALK -> new AgentPlan(intent, false, List.of());
            case GENERAL -> new AgentPlan(intent, true, ALL_TOOLS);
        };
    }
}
