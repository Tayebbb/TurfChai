package com.turfchai.ai.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.config.AiProperties;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * {@link LlmProvider} backed by the Google Gemini {@code generateContent} API.
 * Translates the provider-agnostic request/response model to and from
 * Gemini's content/parts/functionCall format.
 */
public class GeminiLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiLlmProvider.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AiProperties.Gemini config;

    public GeminiLlmProvider(RestClient restClient, ObjectMapper objectMapper, AiProperties.Gemini config) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.config = config;
    }

    @Override
    public String name() {
        return "gemini";
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        Map<String, Object> body = buildRequestBody(request);
        String raw;
        try {
            // Read as String and parse ourselves: Boot 4's converters use
            // Jackson 3 and cannot produce Jackson 2 JsonNode instances.
            raw = restClient.post()
                    .uri("/models/{model}:generateContent", config.getModel())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            // All HTTP failures (quota 429, auth, 5xx) are fallback-eligible.
            throw new LlmException("Gemini request failed with HTTP " + e.getStatusCode().value(), e, true);
        } catch (RestClientException e) {
            throw new LlmException("Gemini request failed: " + e.getMessage(), e, true);
        }
        if (raw == null || raw.isBlank()) {
            throw new LlmException("Gemini returned an empty response", null, true);
        }
        return parseResponse(readTree(raw));
    }

    private JsonNode readTree(String raw) {
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            throw new LlmException("Gemini returned malformed JSON", e, true);
        }
    }

    // ── request mapping ──────────────────────────────────────────────────

    Map<String, Object> buildRequestBody(LlmRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();

        String systemText = request.messages().stream()
                .filter(m -> m.role() == ChatRole.SYSTEM)
                .map(ChatMessage::content)
                .reduce((a, b) -> a + "\n\n" + b)
                .orElse(null);
        if (systemText != null) {
            body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemText))));
        }

        List<Map<String, Object>> contents = new ArrayList<>();
        for (ChatMessage message : request.messages()) {
            switch (message.role()) {
                case USER -> contents.add(content("user", Map.of("text", message.content())));
                case ASSISTANT -> {
                    if (message.toolCall() != null) {
                        contents.add(content("model", Map.of("functionCall", Map.of(
                                "name", message.toolCall().name(),
                                "args", message.toolCall().arguments()))));
                    } else {
                        contents.add(content("model", Map.of("text", message.content())));
                    }
                }
                case TOOL -> contents.add(content("user", Map.of("functionResponse", Map.of(
                        "name", message.toolName(),
                        "response", toStructured(message.content())))));
                case SYSTEM -> {
                    /* merged into systemInstruction above */ }
            }
        }
        body.put("contents", contents);

        if (!request.tools().isEmpty()) {
            body.put("tools", List.of(Map.of("functionDeclarations",
                    request.tools().stream().map(this::toFunctionDeclaration).toList())));
        }
        return body;
    }

    private Map<String, Object> content(String role, Map<String, Object> part) {
        return Map.of("role", role, "parts", List.of(part));
    }

    /** Tool results are JSON; send them structured to avoid double-encoding. */
    private Object toStructured(String json) {
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructMapType(LinkedHashMap.class, String.class, Object.class));
        } catch (Exception e) {
            return Map.of("result", json);
        }
    }

    private Map<String, Object> toFunctionDeclaration(ToolSpec spec) {
        Map<String, Object> properties = new LinkedHashMap<>();
        List<String> required = new ArrayList<>();
        for (ToolParam param : spec.parameters()) {
            properties.put(param.name(), Map.of(
                    "type", param.type(),
                    "description", param.description()));
            if (param.required()) {
                required.add(param.name());
            }
        }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        if (!required.isEmpty()) {
            schema.put("required", required);
        }
        return Map.of(
                "name", spec.name(),
                "description", spec.description(),
                "parameters", schema);
    }

    // ── response mapping ─────────────────────────────────────────────────

    LlmResponse parseResponse(JsonNode root) {
        JsonNode candidate = root.path("candidates").path(0);
        if (candidate.isMissingNode()) {
            String blockReason = root.path("promptFeedback").path("blockReason").asText("");
            if (!blockReason.isEmpty()) {
                throw new LlmException("Gemini blocked the prompt: " + blockReason);
            }
            throw new LlmException("Gemini returned no candidates");
        }

        List<ToolCall> toolCalls = new ArrayList<>();
        StringBuilder text = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            if (part.has("functionCall")) {
                JsonNode call = part.get("functionCall");
                Map<String, Object> args = objectMapper.convertValue(
                        call.path("args"), objectMapper.getTypeFactory()
                                .constructMapType(LinkedHashMap.class, String.class, Object.class));
                toolCalls.add(new ToolCall(call.path("name").asText(), args));
            } else if (part.has("text")) {
                text.append(part.get("text").asText());
            }
        }

        TokenUsage usage = TokenUsage.UNKNOWN;
        JsonNode usageNode = root.path("usageMetadata");
        if (!usageNode.isMissingNode()) {
            usage = new TokenUsage(
                    usageNode.path("promptTokenCount").asInt(0),
                    usageNode.path("candidatesTokenCount").asInt(0));
        }

        if (!toolCalls.isEmpty()) {
            log.debug("Gemini requested {} tool call(s)", toolCalls.size());
            return new LlmResponse(null, toolCalls, usage);
        }
        return new LlmResponse(text.toString(), List.of(), usage);
    }
}
