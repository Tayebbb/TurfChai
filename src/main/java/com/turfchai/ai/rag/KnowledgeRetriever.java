package com.turfchai.ai.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Retrieval facade: lazily indexes the static knowledge base on first use
 * (avoids network calls at application startup), then serves top-k lookups.
 */
public class KnowledgeRetriever {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeRetriever.class);

    private final ClasspathDocumentLoader documentLoader;
    private final TextChunker chunker;
    private final EmbeddingProvider embeddingProvider;
    private final VectorStore vectorStore;
    private final int topK;
    private final double minScore;

    private volatile boolean indexed = false;

    public KnowledgeRetriever(ClasspathDocumentLoader documentLoader,
            TextChunker chunker,
            EmbeddingProvider embeddingProvider,
            VectorStore vectorStore,
            int topK,
            double minScore) {
        this.documentLoader = documentLoader;
        this.chunker = chunker;
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
        this.topK = topK;
        this.minScore = minScore;
    }

    public List<ScoredChunk> retrieve(String query) {
        ensureIndexed();
        return vectorStore.search(embeddingProvider.embed(query), topK, minScore);
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
        synchronized (this) {
            if (indexed)
                return;
            try {
                List<Document> documents = documentLoader.loadAll();
                int chunkCount = 0;
                for (Document document : documents) {
                    for (DocumentChunk chunk : chunker.chunk(document)) {
                        vectorStore.add(chunk, embeddingProvider.embed(chunk.content()));
                        chunkCount++;
                    }
                }
                log.info("Indexed {} knowledge documents into {} chunks using '{}' embeddings",
                        documents.size(), chunkCount, embeddingProvider.name());
                indexed = true;
            } catch (RuntimeException e) {
                // Drop partial index so a retry starts clean (no duplicates).
                vectorStore.clear();
                throw new RagException("Knowledge indexing failed", e);
            }
        }
    }
}
