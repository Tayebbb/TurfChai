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
}
