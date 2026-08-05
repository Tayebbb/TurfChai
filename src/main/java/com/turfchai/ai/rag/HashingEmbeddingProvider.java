package com.turfchai.ai.rag;

import java.util.Locale;

/**
 * Deterministic bag-of-words hashing embedder. Zero-dependency fallback for
 * local development and tests when no embedding API is configured. It gives
 * lexical (not semantic) similarity, which is sufficient for keyword-heavy
 * policy/FAQ retrieval.
 */
public class HashingEmbeddingProvider implements EmbeddingProvider {

    private static final int DIMENSION = 512;

    @Override
    public String name() {
        return "hashing";
    }

    @Override
    public int dimension() {
        return DIMENSION;
    }

    @Override
    public float[] embed(String text) {
        float[] vector = new float[DIMENSION];
        for (String token : tokenize(text)) {
            int bucket = Math.floorMod(token.hashCode(), DIMENSION);
            vector[bucket] += 1.0f;
        }
        normalize(vector);
        return vector;
    }

    private String[] tokenize(String text) {
        return text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+");
    }

    private void normalize(float[] vector) {
        double sumSquares = 0;
        for (float v : vector)
            sumSquares += v * v;
        if (sumSquares == 0)
            return;
        float norm = (float) Math.sqrt(sumSquares);
        for (int i = 0; i < vector.length; i++)
            vector[i] /= norm;
    }
}
