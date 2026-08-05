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
 * {@link LlmProvider} backed by the Hugging Face Inference Router
 * (OpenAI-compatible {@code /chat/completions} API). Used as the fallback
 * when Gemini fails or exhausts its quota.
 */
public class HuggingFaceLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(HuggingFaceLlmProvider.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AiProperties.HuggingFace config;

    public HuggingFaceLlmProvider(RestClient restClient, ObjectMapper objectMapper,
            AiProperties.HuggingFace config) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.config = config;
    }

    @Override
    public String name() {
        return "huggingface";
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
            throw new LlmException("Hugging Face request failed with HTTP " + status, e, retryable);
        } catch (RestClientException e) {
            throw new LlmException("Hugging Face request failed: " + e.getMessage(), e, true);
        }
        if (raw == null || raw.isBlank()) {
            throw new LlmException("Hugging Face returned an empty response");
        }
        try {
            return parseResponse(objectMapper.readTree(raw));
        } catch (JsonProcessingException e) {
            throw new LlmException("Hugging Face returned malformed JSON", e, false);
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
        body.put("messages", messages);
        body.put("temperature", config.getTemperature());
        body.put("top_p", config.getTopP());
        body.put("max_tokens", config.getMaxTokens());
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
            throw new LlmException("Hugging Face returned no choices");
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
            log.debug("Hugging Face requested {} tool call(s)", toolCalls.size());
            return new LlmResponse(null, toolCalls, usage);
        }
        return new LlmResponse(message.path("content").asText(""), List.of(), usage);
    }

    private Map<String, Object> parseArguments(String json) {
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructMapType(LinkedHashMap.class, String.class, Object.class));
        } catch (JsonProcessingException e) {
            throw new LlmException("Hugging Face returned malformed tool arguments", e, false);
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
