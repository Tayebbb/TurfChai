package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MockVenueSearchToolTest {

    private static final ToolContext CTX = new ToolContext("s1", "u1");

    private final MockVenueSearchTool tool = new MockVenueSearchTool();

    @Test
    @SuppressWarnings("unchecked")
    void filtersByAreaAndSport() {
        ToolResult result = tool.execute(Map.of("area", "Banani", "sport", "football"), CTX);
        assertThat(result.success()).isTrue();
        Map<String, Object> data = (Map<String, Object>) result.data();
        List<Map<String, Object>> venues = (List<Map<String, Object>>) data.get("venues");
        assertThat(venues).hasSize(1);
        assertThat(venues.get(0).get("name")).isEqualTo("GreenTurf Arena");
    }

    @Test
    @SuppressWarnings("unchecked")
    void filtersByMaxPrice() {
        ToolResult result = tool.execute(Map.of("maxPricePerHour", 1600), CTX);
        Map<String, Object> data = (Map<String, Object>) result.data();
        assertThat((Integer) data.get("count")).isEqualTo(1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void noFiltersReturnsAll() {
        ToolResult result = tool.execute(Map.of(), CTX);
        Map<String, Object> data = (Map<String, Object>) result.data();
        assertThat((Integer) data.get("count")).isEqualTo(5);
    }
}
