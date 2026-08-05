package com.turfchai.ai.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Retrieval facade: lazily indexes the static knowledge base on first use
 * (avoids network calls at application startup), then serves top-k lookups.
 *
 * <p>
 * If the primary embedding provider fails (e.g. API quota exhausted),
 * the retriever permanently downgrades to the offline fallback provider and
 * re-indexes, so policy/FAQ answers keep working without the network.
 * Index and query always use the same provider — vectors from different
 * models are never mixed in one store.
 */
public class KnowledgeRetriever {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeRetriever.class);

    private final ClasspathDocumentLoader documentLoader;
    private final TextChunker chunker;
    private final EmbeddingProvider primaryProvider;
    private final EmbeddingProvider fallbackProvider;
    private final VectorStore vectorStore;
    private final int topK;
    private final double minScore;

    private EmbeddingProvider activeProvider;
    private boolean indexed = false;

    public KnowledgeRetriever(ClasspathDocumentLoader documentLoader,
            TextChunker chunker,
            EmbeddingProvider primaryProvider,
            EmbeddingProvider fallbackProvider,
            VectorStore vectorStore,
            int topK,
            double minScore) {
        this.documentLoader = documentLoader;
        this.chunker = chunker;
        this.primaryProvider = primaryProvider;
        this.fallbackProvider = fallbackProvider;
        this.vectorStore = vectorStore;
        this.topK = topK;
        this.minScore = minScore;
        this.activeProvider = primaryProvider;
    }

    public synchronized List<ScoredChunk> retrieve(String query) {
        ensureIndexed();
        float[] queryEmbedding;
        try {
            queryEmbedding = activeProvider.embed(query);
        } catch (RuntimeException e) {
            downgradeOrRethrow(e);
            ensureIndexed();
            queryEmbedding = activeProvider.embed(query);
        }
        return vectorStore.search(queryEmbedding, topK, minScore);
    }

    /** Retrieved chunks rendered for prompt injection, with source attribution. */
    public String retrieveAsContext(String query) {
        return retrieve(query).stream()
                .map(sc -> "[source: " + sc.chunk().source() + "]\n" + sc.chunk().content())
                .collect(Collectors.joining("\n\n"));
    }

    private void ensureIndexed() {
        if (indexed)
            return;
        try {
            index();
        } catch (RuntimeException e) {
            vectorStore.clear();
            downgradeOrRethrow(e);
            index(); // fallback is offline and deterministic — cannot fail
        }
    }

    private void index() {
        List<Document> documents = documentLoader.loadAll();
        int chunkCount = 0;
        for (Document document : documents) {
            for (DocumentChunk chunk : chunker.chunk(document)) {
                vectorStore.add(chunk, activeProvider.embed(chunk.content()));
                chunkCount++;
            }
        }
        log.info("Indexed {} knowledge documents into {} chunks using '{}' embeddings",
                documents.size(), chunkCount, activeProvider.name());
        indexed = true;
    }

    /** Sticky downgrade: switch to the fallback provider and rebuild the index. */
    private void downgradeOrRethrow(RuntimeException cause) {
        if (fallbackProvider == null || activeProvider == fallbackProvider) {
            throw cause instanceof RagException re ? re : new RagException("Embedding failed", cause);
        }
        log.warn("Embedding provider '{}' failed ({}); downgrading permanently to '{}'",
                activeProvider.name(), cause.getMessage(), fallbackProvider.name());
        activeProvider = fallbackProvider;
        vectorStore.clear();
        indexed = false;
    }
}
