package com.turfchai.ai.state;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BookingStateTest {

    @Test
    void freshStateIsEmptyAndNotReady() {
        BookingState state = new BookingState();
        assertThat(state.isEmpty()).isTrue();
        assertThat(state.isReadyToBook()).isFalse();
        assertThat(state.summary()).isEmpty();
    }

    @Test
    void readyToBookRequiresVenueDateAndTime() {
        BookingState state = new BookingState();
        state.setVenueId("V-0044");
        state.setDate("2026-08-10");
        assertThat(state.isReadyToBook()).isFalse();
        state.setTime("19:00-20:00");
        assertThat(state.isReadyToBook()).isTrue();
    }

    @Test
    void summaryRendersOnlySetFields() {
        BookingState state = new BookingState();
        state.setSport("football");
        state.setBudget(2500);
        assertThat(state.summary()).isEqualTo("sport=football, budget=৳2500");
    }

    @Test
    void storeIsolatesAndClearsSessions() {
        InMemoryConversationStateStore store = new InMemoryConversationStateStore();
        store.get("s1").setSport("football");

        assertThat(store.get("s2").isEmpty()).isTrue();
        store.clear("s1");
        assertThat(store.get("s1").isEmpty()).isTrue();
    }
}
