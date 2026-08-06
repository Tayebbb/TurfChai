package com.turfchai.ai.rag;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Cosine-similarity vector store held in memory. Suitable for the current
 * knowledge-base size (a handful of documents); swap for pgvector at scale.
 */
public class InMemoryVectorStore implements VectorStore {

    private static final class Entry {
        private final DocumentChunk chunk;
        private final float[] embedding;

        private Entry(DocumentChunk chunk, float[] embedding) {
            this.chunk = chunk;
            this.embedding = embedding;
        }

        DocumentChunk chunk() {
            return chunk;
        }

        float[] embedding() {
            return embedding;
        }
    }

    private final List<Entry> entries = new CopyOnWriteArrayList<>();

    @Override
    public void add(DocumentChunk chunk, float[] embedding) {
        if (chunk == null || embedding == null) {
            throw new IllegalArgumentException("chunk and embedding must not be null");
        }
        entries.add(new Entry(chunk, embedding.clone()));
    }

    @Override
    public List<ScoredChunk> search(float[] queryEmbedding, int topK, double minScore) {
        if (queryEmbedding == null || topK <= 0) {
            return Collections.emptyList();
        }

        List<ScoredChunk> scored = new ArrayList<>(entries.size());
        for (Entry entry : entries) {
            double score = cosine(queryEmbedding, entry.embedding());
            if (score >= minScore) {
                scored.add(new ScoredChunk(entry.chunk(), score));
            }
        }

        scored.sort(Comparator.comparingDouble((ScoredChunk sc) -> sc.score()).reversed());
        if (scored.size() <= topK) {
            return Collections.unmodifiableList(new ArrayList<>(scored));
        }
        return Collections.unmodifiableList(new ArrayList<>(scored.subList(0, topK)));
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
        if (a == null || b == null || a.length != b.length) {
            return 0;
        }
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0 || normB == 0) {
            return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
