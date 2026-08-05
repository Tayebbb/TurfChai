package com.turfchai.ai.rag;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end retrieval over the real classpath knowledge base using the
 * offline hashing embedder.
 */
class KnowledgeRetrieverTest {

    private final KnowledgeRetriever retriever = new KnowledgeRetriever(
            new ClasspathDocumentLoader(),
            new TextChunker(800, 120),
            new HashingEmbeddingProvider(),
            null,
            new InMemoryVectorStore(),
            4, 0.05);

    @Test
    void retrievesRefundPolicyForRefundQuestion() {
        List<ScoredChunk> results = retriever.retrieve("how much refund do I get if I cancel 10 hours before?");
        assertThat(results).isNotEmpty();
        assertThat(results.get(0).chunk().source()).isEqualTo("cancellation-refund-policy.md");
    }

    @Test
    void retrievesLoyaltyDocForPointsQuestion() {
        List<ScoredChunk> results = retriever.retrieve("how many points do I need for the gold loyalty tier discount?");
        assertThat(results)
                .extracting(r -> r.chunk().source())
                .contains("loyalty-rewards.md");
    }

    @Test
    void contextStringCarriesSourceAttribution() {
        String context = retriever.retrieveAsContext("cancellation refund policy");
        assertThat(context).contains("[source:");
    }

    @Test
    void embeddingsAreDeterministic() {
        HashingEmbeddingProvider provider = new HashingEmbeddingProvider();
        assertThat(provider.embed("turf booking")).isEqualTo(provider.embed("turf booking"));
    }

    @Test
    void downgradesToFallbackWhenPrimaryEmbeddingFailsDuringIndexing() {
        EmbeddingProvider broken = new EmbeddingProvider() {
            @Override public String name() { return "broken"; }
            @Override public int dimension() { return 8; }
            @Override public float[] embed(String text) { throw new RagException("quota exhausted"); }
        };
        InMemoryVectorStore store = new InMemoryVectorStore();
        KnowledgeRetriever fallbackRetriever = new KnowledgeRetriever(
                new ClasspathDocumentLoader(), new TextChunker(800, 120),
                broken, new HashingEmbeddingProvider(), store, 4, 0.05);

        List<ScoredChunk> results = fallbackRetriever.retrieve("cancellation refund policy");

        assertThat(results).isNotEmpty();          // served by fallback embeddings
        assertThat(store.size()).isGreaterThan(0); // index rebuilt with fallback
    }

    @Test
    void downgradesWhenPrimaryFailsAtQueryTime() {
        // Primary works during indexing, then starts failing at query time.
        EmbeddingProvider flaky = new EmbeddingProvider() {
            final HashingEmbeddingProvider delegate = new HashingEmbeddingProvider();
            int calls = 0;
            @Override public String name() { return "flaky"; }
            @Override public int dimension() { return delegate.dimension(); }
            @Override public float[] embed(String text) {
                calls++;
                if (calls > 30) throw new RagException("quota exhausted");   // fails after indexing
                return delegate.embed(text);
            }
        };
        KnowledgeRetriever flakyRetriever = new KnowledgeRetriever(
                new ClasspathDocumentLoader(), new TextChunker(800, 120),
                flaky, new HashingEmbeddingProvider(), new InMemoryVectorStore(), 4, 0.05);

        flakyRetriever.retrieve("refund");                       // indexes + queries with primary
        List<ScoredChunk> results = flakyRetriever.retrieve("refund policy details please");

        assertThat(results).isNotEmpty();
    }

    @Test
    void withoutFallbackPrimaryFailurePropagates() {
        EmbeddingProvider broken = new EmbeddingProvider() {
            @Override public String name() { return "broken"; }
            @Override public int dimension() { return 8; }
            @Override public float[] embed(String text) { throw new RagException("down"); }
        };
        KnowledgeRetriever noFallback = new KnowledgeRetriever(
                new ClasspathDocumentLoader(), new TextChunker(800, 120),
                broken, null, new InMemoryVectorStore(), 4, 0.05);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> noFallback.retrieve("refund"))
                .isInstanceOf(RagException.class);
    }
}
