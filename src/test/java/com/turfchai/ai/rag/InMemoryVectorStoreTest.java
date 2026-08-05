package com.turfchai.ai.rag;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryVectorStoreTest {

    private final InMemoryVectorStore store = new InMemoryVectorStore();

    @Test
    void returnsMostSimilarFirst() {
        store.add(chunk("a"), new float[]{1, 0, 0});
        store.add(chunk("b"), new float[]{0, 1, 0});
        store.add(chunk("c"), new float[]{0.9f, 0.1f, 0});

        List<ScoredChunk> results = store.search(new float[]{1, 0, 0}, 2, 0.0);

        assertThat(results).hasSize(2);
        assertThat(results.get(0).chunk().id()).isEqualTo("a");
        assertThat(results.get(1).chunk().id()).isEqualTo("c");
    }

    @Test
    void filtersByMinScore() {
        store.add(chunk("a"), new float[]{1, 0});
        store.add(chunk("b"), new float[]{0, 1});

        List<ScoredChunk> results = store.search(new float[]{1, 0}, 10, 0.5);

        assertThat(results).extracting(r -> r.chunk().id()).containsExactly("a");
    }

    @Test
    void emptyStoreReturnsNothing() {
        assertThat(store.search(new float[]{1}, 5, 0)).isEmpty();
    }

    private DocumentChunk chunk(String id) {
        return new DocumentChunk(id, "doc", "test.md", 0, "content " + id);
    }
}
