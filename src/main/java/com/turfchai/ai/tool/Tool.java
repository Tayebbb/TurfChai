package com.turfchai.ai.tool;

import java.util.Map;

/**
 * The only gateway between the AI agent and application functionality.
 * The LLM never touches repositories, SQL or business services directly —
 * it can only request execution of a registered {@link Tool}.
 *
 * <p>
 * Implementations must validate their own arguments and return
 * {@link ToolResult#fail(String)} rather than throw for expected failures.
 */
public interface Tool {

    ToolSpec spec();

    ToolResult execute(Map<String, Object> arguments, ToolContext context);
}
