package com.turfchai.ai.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.config.AiProperties;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolSpec;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Verifies the provider-agnostic ↔ Gemini wire-format mapping. */
class GeminiLlmProviderTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final GeminiLlmProvider provider =
            new GeminiLlmProvider(null, mapper, new AiProperties.Gemini());

    // ── request mapping ──────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void systemMessagesMergeIntoSystemInstruction() {
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.system("base"), ChatMessage.system("safety"),
                        ChatMessage.user("hello")),
                List.of()));

        Map<String, Object> instruction = (Map<String, Object>) body.get("systemInstruction");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) instruction.get("parts");
        assertThat(parts.get(0).get("text")).isEqualTo("base\n\nsafety");

        List<Map<String, Object>> contents = (List<Map<String, Object>>) body.get("contents");
        assertThat(contents).hasSize(1);   // system messages excluded from contents
        assertThat(contents.get(0).get("role")).isEqualTo("user");
    }

    @Test
    @SuppressWarnings("unchecked")
    void toolCallRoundTripUsesFunctionCallAndFunctionResponseParts() {
        ToolCall call = new ToolCall("search_venues", Map.of("area", "Banani"));
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.user("find turfs"),
                        ChatMessage.assistantToolCall(call),
                        ChatMessage.tool("search_venues", "{\"success\":true,\"data\":{\"count\":1}}")),
                List.of()));

        List<Map<String, Object>> contents = (List<Map<String, Object>>) body.get("contents");
        assertThat(contents).hasSize(3);

        // model turn must be a functionCall part, not text
        Map<String, Object> modelTurn = contents.get(1);
        assertThat(modelTurn.get("role")).isEqualTo("model");
        Map<String, Object> fnCall = (Map<String, Object>)
                ((List<Map<String, Object>>) modelTurn.get("parts")).get(0).get("functionCall");
        assertThat(fnCall.get("name")).isEqualTo("search_venues");
        assertThat((Map<String, Object>) fnCall.get("args")).containsEntry("area", "Banani");

        // tool turn is a structured functionResponse (no double-encoded JSON string)
        Map<String, Object> toolTurn = contents.get(2);
        Map<String, Object> fnResponse = (Map<String, Object>)
                ((List<Map<String, Object>>) toolTurn.get("parts")).get(0).get("functionResponse");
        assertThat(fnResponse.get("name")).isEqualTo("search_venues");
        Map<String, Object> response = (Map<String, Object>) fnResponse.get("response");
        assertThat(response.get("success")).isEqualTo(true);
    }

    @Test
    @SuppressWarnings("unchecked")
    void toolSpecsBecomeFunctionDeclarations() {
        ToolSpec spec = new ToolSpec("demo", "demo tool", List.of(
                ToolParam.required("a", "string", "first"),
                ToolParam.optional("b", "integer", "second")));
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.user("x")), List.of(spec)));

        List<Map<String, Object>> tools = (List<Map<String, Object>>) body.get("tools");
        List<Map<String, Object>> declarations =
                (List<Map<String, Object>>) tools.get(0).get("functionDeclarations");
        Map<String, Object> declaration = declarations.get(0);
        assertThat(declaration.get("name")).isEqualTo("demo");
        Map<String, Object> params = (Map<String, Object>) declaration.get("parameters");
        assertThat((Map<String, Object>) params.get("properties")).containsKeys("a", "b");
        assertThat((List<String>) params.get("required")).containsExactly("a");
    }

    // ── response mapping ─────────────────────────────────────────────────

    @Test
    void parsesTextResponseWithUsage() throws Exception {
        JsonNode root = mapper.readTree("""
                {"candidates":[{"content":{"parts":[{"text":"Hello!"}]}}],
                 "usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5}}""");

        LlmResponse response = provider.parseResponse(root);

        assertThat(response.text()).isEqualTo("Hello!");
        assertThat(response.hasToolCalls()).isFalse();
        assertThat(response.usage().total()).isEqualTo(15);
    }

    @Test
    void parsesFunctionCallResponse() throws Exception {
        JsonNode root = mapper.readTree("""
                {"candidates":[{"content":{"parts":[
                  {"functionCall":{"name":"search_venues","args":{"area":"Banani"}}}]}}]}""");

        LlmResponse response = provider.parseResponse(root);

        assertThat(response.hasToolCalls()).isTrue();
        assertThat(response.toolCalls().get(0).name()).isEqualTo("search_venues");
        assertThat(response.toolCalls().get(0).arguments()).containsEntry("area", "Banani");
    }

    @Test
    void blockedPromptRaisesLlmException() throws Exception {
        JsonNode root = mapper.readTree("""
                {"candidates":[],"promptFeedback":{"blockReason":"SAFETY"}}""");

        assertThatThrownBy(() -> provider.parseResponse(root))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("SAFETY");
    }

    @Test
    void emptyCandidatesRaisesLlmException() throws Exception {
        JsonNode root = mapper.readTree("{}");
        assertThatThrownBy(() -> provider.parseResponse(root)).isInstanceOf(LlmException.class);
    }
}
