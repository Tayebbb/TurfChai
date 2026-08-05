package com.turfchai.ai.rag;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Cosine-similarity vector store held in memory. Suitable for the current
 * knowledge-base size (a handful of documents); swap for pgvector at scale.
 */
public class InMemoryVectorStore implements VectorStore {

    private record Entry(DocumentChunk chunk, float[] embedding) {
    }

    private final List<Entry> entries = new CopyOnWriteArrayList<>();

    @Override
    public void add(DocumentChunk chunk, float[] embedding) {
        entries.add(new Entry(chunk, embedding.clone()));
    }

    @Override
    public List<ScoredChunk> search(float[] queryEmbedding, int topK, double minScore) {
        List<ScoredChunk> scored = new ArrayList<>(entries.size());
        for (Entry entry : entries) {
            double score = cosine(queryEmbedding, entry.embedding());
            if (score >= minScore) {
                scored.add(new ScoredChunk(entry.chunk(), score));
            }
        }
        scored.sort(Comparator.comparingDouble(ScoredChunk::score).reversed());
        return scored.size() > topK ? List.copyOf(scored.subList(0, topK)) : scored;
    }

    @Override
    public int size() {
        return entries.size();
    }

    @Override
    public void clear() {
        entries.clear();
    }

    private double cosine(float[] a, float[] b) {
        if (a.length != b.length)
            return 0;
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0 || normB == 0)
            return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
