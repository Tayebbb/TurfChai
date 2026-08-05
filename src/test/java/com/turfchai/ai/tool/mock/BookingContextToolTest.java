package com.turfchai.ai.tool.mock;

import com.turfchai.ai.state.BookingState;
import com.turfchai.ai.state.InMemoryConversationStateStore;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolResult;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BookingContextToolTest {

    private final InMemoryConversationStateStore store = new InMemoryConversationStateStore();
    private final BookingContextTool tool = new BookingContextTool(store);

    @Test
    void persistsDetailsIntoSessionState() {
        tool.execute(Map.of("sport", "football", "date", "2026-08-10", "players", 10),
                new ToolContext("s1", "u1"));

        BookingState state = store.get("s1");
        assertThat(state.getSport()).isEqualTo("football");
        assertThat(state.getDate()).isEqualTo("2026-08-10");
        assertThat(state.getPlayers()).isEqualTo(10);
        assertThat(state.isReadyToBook()).isFalse();
    }

    @Test
    void reportsReadyToBookWhenVenueDateTimeSet() {
        ToolResult result = tool.execute(Map.of(
                "venueId", "V-0044", "venueName", "GreenTurf Arena",
                "date", "2026-08-10", "time", "19:00-20:00"),
                new ToolContext("s2", "u1"));

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.data();
        assertThat(data.get("readyToBook")).isEqualTo(true);
    }

    @Test
    void sessionsAreIsolated() {
        tool.execute(Map.of("sport", "cricket"), new ToolContext("s3", "u1"));
        assertThat(store.get("s4").isEmpty()).isTrue();
    }
}
