package com.turfchai.ai.rag;

/** One indexable slice of a {@link Document}. */
public record DocumentChunk(String id, String documentId, String source, int index, String content) {
}
