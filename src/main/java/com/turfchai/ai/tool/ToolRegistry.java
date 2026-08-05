package com.turfchai.ai.tool;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry of all tools available to the agent. Execution goes through
 * {@link #execute} so unknown tools and unexpected exceptions are converted
 * into structured failures the model can recover from.
 */
public class ToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistry.class);

    private final Map<String, Tool> tools = new ConcurrentHashMap<>();

    public ToolRegistry(List<Tool> toolList) {
        for (Tool tool : toolList) {
            register(tool);
        }
    }

    public void register(Tool tool) {
        String name = tool.spec().name();
        Tool previous = tools.putIfAbsent(name, tool);
        if (previous != null) {
            throw new IllegalStateException("Duplicate tool registration: " + name);
        }
    }

    public Optional<Tool> find(String name) {
        return Optional.ofNullable(tools.get(name));
    }

    public List<ToolSpec> specs() {
        return tools.values().stream().map(Tool::spec).toList();
    }

    /** Specs restricted to an allow-list (planner scoping). */
    public List<ToolSpec> specs(List<String> allowedNames) {
        return specs().stream().filter(s -> allowedNames.contains(s.name())).toList();
    }

    public ToolResult execute(String name, Map<String, Object> arguments, ToolContext context) {
        Tool tool = tools.get(name);
        if (tool == null) {
            log.warn("Model requested unknown tool '{}'", name);
            return ToolResult.fail("Unknown tool: " + name);
        }
        try {
            return tool.execute(arguments == null ? Map.of() : arguments, context);
        } catch (Exception e) {
            log.error("Tool '{}' threw unexpectedly", name, e);
            return ToolResult.fail("Tool execution failed: " + e.getMessage());
        }
    }
}
