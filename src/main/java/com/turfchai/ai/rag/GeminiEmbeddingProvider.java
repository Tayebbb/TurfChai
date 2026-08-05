package com.turfchai.ai.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.turfchai.ai.config.AiProperties;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * {@link EmbeddingProvider} backed by the Gemini {@code embedContent} API
 * (text-embedding-004, 768 dimensions).
 */
public class GeminiEmbeddingProvider implements EmbeddingProvider {

    private static final int DIMENSION = 768;

    private final RestClient restClient;
    private final AiProperties.Gemini config;

    public GeminiEmbeddingProvider(RestClient restClient, AiProperties.Gemini config) {
        this.restClient = restClient;
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
        JsonNode root;
        try {
            root = restClient.post()
                    .uri("/models/{model}:embedContent", config.getEmbeddingModel())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("content", Map.of("parts", List.of(Map.of("text", text)))))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new RagException("Gemini embedding request failed: " + e.getMessage(), e);
        }
        if (root == null) {
            throw new RagException("Gemini embedding returned an empty response");
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
