package com.turfchai.ai.rag;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TextChunkerTest {

    @Test
    void shortDocumentIsSingleChunk() {
        TextChunker chunker = new TextChunker(200, 20);
        List<DocumentChunk> chunks = chunker.chunk(doc("short content"));
        assertThat(chunks).hasSize(1);
        assertThat(chunks.get(0).content()).isEqualTo("short content");
    }

    @Test
    void longDocumentIsSplitWithOverlap() {
        String paragraph = "word ".repeat(100).strip();          // ~500 chars
        String text = paragraph + "\n\n" + paragraph + "\n\n" + paragraph;
        TextChunker chunker = new TextChunker(600, 100);

        List<DocumentChunk> chunks = chunker.chunk(doc(text));

        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allSatisfy(c -> assertThat(c.content().length()).isLessThanOrEqualTo(600));
        // sequential indexes
        for (int i = 0; i < chunks.size(); i++) {
            assertThat(chunks.get(i).index()).isEqualTo(i);
        }
    }

    @Test
    void rejectsInvalidConfig() {
        assertThatThrownBy(() -> new TextChunker(0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TextChunker(100, 100)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void handlesTextWithoutAnyWhitespace() {
        String text = "x".repeat(1500);
        TextChunker chunker = new TextChunker(600, 100);

        List<DocumentChunk> chunks = chunker.chunk(doc(text));

        assertThat(chunks).hasSizeGreaterThanOrEqualTo(3);
        int totalLength = chunks.stream().mapToInt(c -> c.content().length()).sum();
        assertThat(totalLength).isGreaterThanOrEqualTo(1500);   // full coverage incl. overlap
    }

    @Test
    void maximalOverlapStillTerminates() {
        TextChunker chunker = new TextChunker(10, 9);
        List<DocumentChunk> chunks = chunker.chunk(doc("abcdefghij klmnopqrst uvwxyz"));
        assertThat(chunks).isNotEmpty();
    }

    private Document doc(String content) {
        return new Document("d1", "test.md", content, Map.of());
    }
}
