package com.turfchai.ai.agent;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;

/**
 * Fixed-payload tool for orchestration tests. The agent's job is routing,
 * scoping, tool-loop control and memory — none of which depends on where a
 * tool gets its data, so these tests must not need a database.
 */
final class StubTool implements Tool {

    private final String name;
    private final Object payload;

    StubTool(String name, Object payload) {
        this.name = name;
        this.payload = payload;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(name, "Test stub for " + name,
                List.of(ToolParam.optional("area", "string", "Area filter")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        return ToolResult.ok(payload);
    }
}
