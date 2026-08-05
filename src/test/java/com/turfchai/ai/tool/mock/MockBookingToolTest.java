package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolResult;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MockBookingToolTest {

    private static final ToolContext USER_A = new ToolContext("s1", "user-a");
    private static final ToolContext USER_B = new ToolContext("s2", "user-b");

    private final MockBookingTool tool = new MockBookingTool();

    @Test
    @SuppressWarnings("unchecked")
    void createThenListThenCancel() {
        ToolResult created = tool.execute(Map.of(
                "action", "create", "venueId", "V-0044",
                "date", "2026-08-10", "time", "19:00-20:00"), USER_A);
        assertThat(created.success()).isTrue();
        String code = (String) ((Map<String, Object>) created.data()).get("bookingCode");
        assertThat(code).startsWith("TC-");

        ToolResult listed = tool.execute(Map.of("action", "list"), USER_A);
        assertThat((Integer) ((Map<String, Object>) listed.data()).get("count")).isEqualTo(1);

        ToolResult cancelled = tool.execute(Map.of("action", "cancel", "bookingCode", code), USER_A);
        assertThat(cancelled.success()).isTrue();

        ToolResult after = tool.execute(Map.of("action", "list"), USER_A);
        assertThat((Integer) ((Map<String, Object>) after.data()).get("count")).isZero();
    }

    @Test
    @SuppressWarnings("unchecked")
    void userCannotCancelAnotherUsersBooking() {
        ToolResult created = tool.execute(Map.of(
                "action", "create", "venueId", "V-0044",
                "date", "2026-08-10", "time", "19:00-20:00"), USER_A);
        String code = (String) ((Map<String, Object>) created.data()).get("bookingCode");

        ToolResult denied = tool.execute(Map.of("action", "cancel", "bookingCode", code), USER_B);
        assertThat(denied.success()).isFalse();
    }

    @Test
    void missingArgumentsFailGracefully() {
        assertThat(tool.execute(Map.of("action", "create"), USER_A).success()).isFalse();
        assertThat(tool.execute(Map.of(), USER_A).success()).isFalse();
        assertThat(tool.execute(Map.of("action", "explode"), USER_A).success()).isFalse();
    }
}
