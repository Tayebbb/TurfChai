package com.turfchai.ai.rag;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Loads static knowledge documents from {@code classpath:/ai-knowledge/}.
 * Only static content (FAQs, policies, guides) belongs here — live data
 * (availability, bookings, prices) must come from tools.
 */
public class ClasspathDocumentLoader {

    private static final String PATTERN = "classpath:/ai-knowledge/*.md";

    public List<Document> loadAll() {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources(PATTERN);
            List<Document> documents = new ArrayList<>(resources.length);
            for (Resource resource : resources) {
                String name = resource.getFilename() == null ? "unknown.md" : resource.getFilename();
                String content = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                documents.add(new Document(name, name, content, Map.of("type", "knowledge")));
            }
            return documents;
        } catch (IOException e) {
            throw new RagException("Failed to load knowledge documents", e);
        }
    }
}
