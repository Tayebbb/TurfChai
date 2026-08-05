package com.turfchai.ai.tool;

import java.util.List;

/** Provider-agnostic description of a callable tool. */
public record ToolSpec(String name, String description, List<ToolParam> parameters) {

    public ToolSpec {
        parameters = parameters == null ? List.of() : List.copyOf(parameters);
    }
}
