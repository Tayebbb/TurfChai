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

/** Verifies the provider-agnostic ↔ OpenAI/Hugging Face wire-format mapping. */
class HuggingFaceLlmProviderTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HuggingFaceLlmProvider provider =
            new HuggingFaceLlmProvider(null, mapper, new AiProperties.HuggingFace());

    // ── request mapping ──────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void mapsRolesAndModel() {
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.system("sys"), ChatMessage.user("hi"), ChatMessage.assistant("yo")),
                List.of()));

        assertThat(body.get("model")).isEqualTo("meta-llama/Llama-3.3-70B-Instruct");
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        assertThat(messages).extracting(m -> m.get("role"))
                .containsExactly("system", "user", "assistant");
    }

    @Test
    @SuppressWarnings("unchecked")
    void toolCallTurnLinksToolResultViaCallId() {
        ToolCall call = new ToolCall("search_venues", Map.of("area", "Banani"));
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.user("find turfs"),
                        ChatMessage.assistantToolCall(call),
                        ChatMessage.tool("search_venues", "{\"success\":true}")),
                List.of()));

        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        Map<String, Object> assistantTurn = messages.get(1);
        List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) assistantTurn.get("tool_calls");
        String callId = (String) toolCalls.get(0).get("id");
        Map<String, Object> function = (Map<String, Object>) toolCalls.get(0).get("function");
        assertThat(function.get("name")).isEqualTo("search_venues");
        assertThat((String) function.get("arguments")).contains("Banani");

        Map<String, Object> toolTurn = messages.get(2);
        assertThat(toolTurn.get("role")).isEqualTo("tool");
        assertThat(toolTurn.get("tool_call_id")).isEqualTo(callId);
    }

    @Test
    @SuppressWarnings("unchecked")
    void toolSpecsBecomeOpenAiFunctionDefinitions() {
        ToolSpec spec = new ToolSpec("demo", "demo tool", List.of(
                ToolParam.required("a", "string", "first")));
        Map<String, Object> body = provider.buildRequestBody(new LlmRequest(
                List.of(ChatMessage.user("x")), List.of(spec)));

        List<Map<String, Object>> tools = (List<Map<String, Object>>) body.get("tools");
        assertThat(tools.get(0).get("type")).isEqualTo("function");
        Map<String, Object> function = (Map<String, Object>) tools.get(0).get("function");
        assertThat(function.get("name")).isEqualTo("demo");
        Map<String, Object> params = (Map<String, Object>) function.get("parameters");
        assertThat((List<String>) params.get("required")).containsExactly("a");
    }

    // ── response mapping ─────────────────────────────────────────────────

    @Test
    void parsesTextResponseWithUsage() throws Exception {
        JsonNode root = mapper.readTree("""
                {"choices":[{"message":{"role":"assistant","content":"Hello!"}}],
                 "usage":{"prompt_tokens":8,"completion_tokens":4}}""");

        LlmResponse response = provider.parseResponse(root);

        assertThat(response.text()).isEqualTo("Hello!");
        assertThat(response.usage().total()).isEqualTo(12);
    }

    @Test
    void parsesToolCallResponseWithStringArguments() throws Exception {
        JsonNode root = mapper.readTree("""
                {"choices":[{"message":{"role":"assistant","tool_calls":[
                  {"id":"c1","type":"function","function":
                    {"name":"search_venues","arguments":"{\\"area\\":\\"Banani\\"}"}}]}}]}""");

        LlmResponse response = provider.parseResponse(root);

        assertThat(response.hasToolCalls()).isTrue();
        assertThat(response.toolCalls().get(0).name()).isEqualTo("search_venues");
        assertThat(response.toolCalls().get(0).arguments()).containsEntry("area", "Banani");
    }

    @Test
    void missingChoicesRaisesLlmException() throws Exception {
        JsonNode root = mapper.readTree("{}");
        assertThatThrownBy(() -> provider.parseResponse(root)).isInstanceOf(LlmException.class);
    }
}
