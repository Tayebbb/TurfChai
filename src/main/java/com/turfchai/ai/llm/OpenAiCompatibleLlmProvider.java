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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * {@link LlmProvider} for any OpenAI-compatible {@code /chat/completions}
 * endpoint — used for both OpenRouter (primary) and the Hugging Face
 * Inference Router (fallback). One implementation, two configurations.
 */
public class OpenAiCompatibleLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleLlmProvider.class);

    private final String providerName;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AiProperties.Endpoint config;

    public OpenAiCompatibleLlmProvider(String providerName, RestClient restClient,
                                       ObjectMapper objectMapper, AiProperties.Endpoint config) {
        this.providerName = providerName;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.config = config;
    }

    @Override
    public String name() {
        return providerName;
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        Map<String, Object> body = buildRequestBody(request);
        String raw;
        try {
            // Read as String and parse ourselves: Boot 4's converters use
            // Jackson 3 and cannot produce Jackson 2 JsonNode instances.
            raw = restClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            // 429/402 = quota/credits, 5xx = outage - all retryable
            boolean retryable = status == 429 || status == 402 || e.getStatusCode().is5xxServerError();
            throw new LlmException(providerName + " request failed with HTTP " + status, e, retryable);
        } catch (RestClientException e) {
            throw new LlmException(providerName + " request failed: " + e.getMessage(), e, true);
        }
        if (raw == null || raw.isBlank()) {
            throw new LlmException(providerName + " returned an empty response");
        }
        try {
            return parseResponse(objectMapper.readTree(raw));
        } catch (JsonProcessingException e) {
            throw new LlmException(providerName + " returned malformed JSON", e, false);
        }
    }

    // ── request mapping (OpenAI wire format) ─────────────────────────────

    Map<String, Object> buildRequestBody(LlmRequest request) {
        List<Map<String, Object>> messages = new ArrayList<>();
        // Deterministic tool_call ids: OpenAI format links tool results to
        // the assistant's call via ids our model doesn't produce.
        Map<String, String> lastCallIdByTool = new HashMap<>();
        int callSeq = 0;

        for (ChatMessage message : request.messages()) {
            switch (message.role()) {
                case SYSTEM -> messages.add(Map.of("role", "system", "content", message.content()));
                case USER -> messages.add(Map.of("role", "user", "content", message.content()));
                case ASSISTANT -> {
                    if (message.toolCall() != null) {
                        String callId = "call_" + (++callSeq);
                        lastCallIdByTool.put(message.toolCall().name(), callId);
                        messages.add(Map.of(
                                "role", "assistant",
                                "tool_calls", List.of(Map.of(
                                        "id", callId,
                                        "type", "function",
                                        "function", Map.of(
                                                "name", message.toolCall().name(),
                                                "arguments", toJson(message.toolCall().arguments()))))));
                    } else {
                        messages.add(Map.of("role", "assistant", "content", message.content()));
                    }
                }
                case TOOL -> messages.add(Map.of(
                        "role", "tool",
                        "tool_call_id", lastCallIdByTool.getOrDefault(message.toolName(), "call_0"),
                        "content", message.content()));
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", config.getModel());
        if (!config.getFallbackModels().isEmpty()) {
            // OpenRouter routing: tried in order when the primary model is
            // rate-limited or unavailable.
            List<String> routing = new ArrayList<>();
            routing.add(config.getModel());
            routing.addAll(config.getFallbackModels());
            body.put("models", routing);
        }
        body.put("messages", messages);
        body.put("temperature", config.getTemperature());
        body.put("top_p", config.getTopP());
        body.put("max_tokens", config.getMaxTokens());
        if (config.isLatencyRouting()) {
            body.put("provider", Map.of("sort", "latency"));
        }
        if (!request.tools().isEmpty()) {
            body.put("tools", request.tools().stream().map(this::toToolDefinition).toList());
        }
        return body;
    }

    private Map<String, Object> toToolDefinition(ToolSpec spec) {
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
        return Map.of("type", "function", "function", Map.of(
                "name", spec.name(),
                "description", spec.description(),
                "parameters", schema));
    }

    // ── response mapping ─────────────────────────────────────────────────

    LlmResponse parseResponse(JsonNode root) {
        JsonNode message = root.path("choices").path(0).path("message");
        if (message.isMissingNode()) {
            String apiError = root.path("error").path("message").asText("");
            if (!apiError.isEmpty()) {
                throw new LlmException(providerName + " error: " + apiError, null, true);
            }
            throw new LlmException(providerName + " returned no choices");
        }

        List<ToolCall> toolCalls = new ArrayList<>();
        for (JsonNode call : message.path("tool_calls")) {
            JsonNode function = call.path("function");
            toolCalls.add(new ToolCall(
                    function.path("name").asText(),
                    parseArguments(function.path("arguments").asText("{}"))));
        }

        TokenUsage usage = TokenUsage.UNKNOWN;
        JsonNode usageNode = root.path("usage");
        if (!usageNode.isMissingNode()) {
            usage = new TokenUsage(
                    usageNode.path("prompt_tokens").asInt(0),
                    usageNode.path("completion_tokens").asInt(0));
        }

        if (!toolCalls.isEmpty()) {
            log.debug("{} requested {} tool call(s)", providerName, toolCalls.size());
            return new LlmResponse(null, toolCalls, usage);
        }
        String content = message.path("content").asText("");
        if (content.isBlank()) {
            // Reasoning models sometimes emit answers outside `content`;
            // retryable so the fallback provider gets a chance.
            throw new LlmException(providerName + " returned an empty reply", null, true);
        }
        return new LlmResponse(content, List.of(), usage);
    }

    private Map<String, Object> parseArguments(String json) {
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructMapType(LinkedHashMap.class, String.class, Object.class));
        } catch (JsonProcessingException e) {
            throw new LlmException(providerName + " returned malformed tool arguments", e, false);
        }
    }

    private String toJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new LlmException("Failed to serialize tool arguments", e, false);
        }
    }
}
