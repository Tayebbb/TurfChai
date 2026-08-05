package com.turfchai.ai.agent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AgentPlannerTest {

    private final AgentPlanner planner = new AgentPlanner();

    @Test
    void policyQuestionsUseRagWithNoTools() {
        AgentPlan plan = planner.plan(Intent.POLICY_QUESTION);
        assertThat(plan.useRetrieval()).isTrue();
        assertThat(plan.allowedTools()).isEmpty();
    }

    @Test
    void bookingScopesToBookingTools() {
        AgentPlan plan = planner.plan(Intent.BOOKING);
        assertThat(plan.useRetrieval()).isFalse();
        assertThat(plan.allowedTools())
                .containsExactlyInAnyOrder("search_venues", "manage_booking", "update_booking_context");
    }

    @Test
    void profileOnlyExposesProfileTool() {
        assertThat(planner.plan(Intent.PROFILE).allowedTools()).containsExactly("get_user_profile");
    }

    @Test
    void smallTalkHasNoToolsNoRag() {
        AgentPlan plan = planner.plan(Intent.SMALL_TALK);
        assertThat(plan.useRetrieval()).isFalse();
        assertThat(plan.allowedTools()).isEmpty();
    }
}
