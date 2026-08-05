package com.turfchai.ai.rag;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits documents into overlapping character-window chunks, preferring to
 * break on paragraph, then sentence, then word boundaries.
 */
public class TextChunker {

    private final int chunkSize;
    private final int overlap;

    public TextChunker(int chunkSize, int overlap) {
        if (chunkSize <= 0)
            throw new IllegalArgumentException("chunkSize must be positive");
        if (overlap < 0 || overlap >= chunkSize) {
            throw new IllegalArgumentException("overlap must be in [0, chunkSize)");
        }
        this.chunkSize = chunkSize;
        this.overlap = overlap;
    }

    public List<DocumentChunk> chunk(Document document) {
        String text = document.content().strip();
        List<DocumentChunk> chunks = new ArrayList<>();
        int start = 0;
        int index = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            if (end < text.length()) {
                end = findBreak(text, start, end);
            }
            String piece = text.substring(start, end).strip();
            if (!piece.isEmpty()) {
                chunks.add(new DocumentChunk(
                        document.id() + "#" + index, document.id(), document.source(), index, piece));
                index++;
            }
            if (end >= text.length())
                break;
            start = Math.max(end - overlap, start + 1);
        }
        return chunks;
    }

    /** Prefer paragraph > sentence > word boundary inside the window's tail. */
    private int findBreak(String text, int start, int hardEnd) {
        int searchFrom = start + (chunkSize / 2);
        int paragraph = text.lastIndexOf("\n\n", hardEnd);
        if (paragraph > searchFrom)
            return paragraph;
        int sentence = text.lastIndexOf(". ", hardEnd - 2);
        if (sentence > searchFrom)
            return sentence + 1;
        int word = text.lastIndexOf(' ', hardEnd);
        if (word > searchFrom)
            return word;
        return hardEnd;
    }
}
