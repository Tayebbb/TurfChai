package com.turfchai.ai.rag;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.config.AiProperties;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * {@link EmbeddingProvider} backed by the Gemini {@code embedContent} API
 * (gemini-embedding-001, 3072 dimensions).
 */
public class GeminiEmbeddingProvider implements EmbeddingProvider {

    private static final int DIMENSION = 3072;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AiProperties.Gemini config;

    public GeminiEmbeddingProvider(RestClient restClient, ObjectMapper objectMapper, AiProperties.Gemini config) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.config = config;
    }

    @Override
    public String name() {
        return "gemini-embedding";
    }

    @Override
    public int dimension() {
        return DIMENSION;
    }

    @Override
    public float[] embed(String text) {
        String raw;
        try {
            // Read as String and parse ourselves: Boot 4's converters use
            // Jackson 3 and cannot produce Jackson 2 JsonNode instances.
            raw = restClient.post()
                    .uri("/models/{model}:embedContent", config.getEmbeddingModel())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("content", Map.of("parts", List.of(Map.of("text", text)))))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            throw new RagException("Gemini embedding request failed: " + e.getMessage(), e);
        }
        if (raw == null || raw.isBlank()) {
            throw new RagException("Gemini embedding returned an empty response");
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            throw new RagException("Gemini embedding returned malformed JSON", e);
        }
        JsonNode values = root.path("embedding").path("values");
        if (!values.isArray() || values.isEmpty()) {
            throw new RagException("Gemini embedding response missing values");
        }
        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = (float) values.get(i).asDouble();
        }
        return vector;
    }
}
