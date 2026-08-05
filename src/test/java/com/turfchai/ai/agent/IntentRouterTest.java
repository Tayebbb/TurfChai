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
}
