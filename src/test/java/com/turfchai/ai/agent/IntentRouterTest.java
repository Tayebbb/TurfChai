package com.turfchai.ai.agent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IntentRouterTest {

    private final IntentRouter router = new IntentRouter();

    @Test
    void routesBookingIntents() {
        assertThat(router.route("I want to book a turf for Friday")).isEqualTo(Intent.BOOKING);
        assertThat(router.route("any slots available tomorrow?")).isEqualTo(Intent.BOOKING);
    }

    @Test
    void routesPolicyQuestions() {
        assertThat(router.route("what is the cancellation refund rule?")).isEqualTo(Intent.POLICY_QUESTION);
    }

    @Test
    void routesPaymentQuestions() {
        assertThat(router.route("did my bkash payment go through?")).isEqualTo(Intent.PAYMENT);
    }

    @Test
    void routesTournaments() {
        assertThat(router.route("upcoming tournament entry fee?")).isEqualTo(Intent.TOURNAMENT);
    }

    @Test
    void routesProfile() {
        assertThat(router.route("show my points balance")).isEqualTo(Intent.PROFILE);
    }

    @Test
    void routesSmallTalkAndFallback() {
        assertThat(router.route("hello")).isEqualTo(Intent.SMALL_TALK);
        assertThat(router.route("")).isEqualTo(Intent.GENERAL);
        assertThat(router.route(null)).isEqualTo(Intent.GENERAL);
        assertThat(router.route("qwerty zxcvb")).isEqualTo(Intent.GENERAL);
    }

    @Test
    void personalQuestionsBeatTheGenericInterrogatives() {
        // These all open with a POLICY_QUESTION trigger ("what is"/"what are"),
        // which routes to RAG with no tools — so the assistant used to deny
        // holding data it can read.
        assertThat(router.route("what is my points balance?")).isEqualTo(Intent.PROFILE);
        assertThat(router.route("what is my wallet worth right now")).isEqualTo(Intent.PROFILE);
        assertThat(router.route("what is my payment status for TC-48291")).isEqualTo(Intent.PAYMENT);
        assertThat(router.route("what are my tournaments this month")).isEqualTo(Intent.TOURNAMENT);
    }

    @Test
    void impersonalPolicyQuestionsStillUseKnowledge() {
        assertThat(router.route("what is the refund policy?")).isEqualTo(Intent.POLICY_QUESTION);
        assertThat(router.route("how does the loyalty tier ladder work?")).isEqualTo(Intent.POLICY_QUESTION);
    }

    @Test
    void pluralsRouteLikeTheirSingular() {
        assertThat(router.route("list 3 turfs in Dhanmondi")).isEqualTo(Intent.VENUE_SEARCH);
        assertThat(router.route("show me venues near Banani")).isEqualTo(Intent.VENUE_SEARCH);
        assertThat(router.route("show my bookings")).isEqualTo(Intent.BOOKING);
    }
}
