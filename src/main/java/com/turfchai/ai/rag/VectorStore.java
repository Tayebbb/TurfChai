package com.turfchai.ai.rag;

import java.util.List;

/**
 * Vector index abstraction. The in-memory implementation is the default;
 * a PostgreSQL + pgvector implementation can replace it without touching
 * the retriever or agent.
 */
public interface VectorStore {

    void add(DocumentChunk chunk, float[] embedding);

    List<ScoredChunk> search(float[] queryEmbedding, int topK, double minScore);

    int size();

    void clear();
}
