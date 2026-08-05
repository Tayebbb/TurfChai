package com.turfchai.ai.rag;

import java.util.Map;

/** A source knowledge document (FAQ, policy, guide). */
public record Document(String id, String source, String content, Map<String, String> metadata) {

    public Document {
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
    }
}
