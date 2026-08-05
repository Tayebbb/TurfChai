package com.turfchai.ai.rag;

/**
 * Abstraction over text-embedding models. Implementations must be
 * stateless and thread-safe.
 */
public interface EmbeddingProvider {

    String name();

    int dimension();

    float[] embed(String text);
}
