package com.turfchai.ai.llm;

/**
 * One message in an LLM conversation.
 * <ul>
 *   <li>ASSISTANT messages that requested a tool carry the original
 *       {@code toolCall} so providers replay a proper function-call turn.</li>
 *   <li>TOOL messages carry the executed tool's {@code toolName} and its
 *       JSON result as {@code content}.</li>
 * </ul>
 */
public record ChatMessage(ChatRole role, String content, String toolName, ToolCall toolCall) {

    public static ChatMessage system(String content) {
        return new ChatMessage(ChatRole.SYSTEM, content, null, null);
    }

    public static ChatMessage user(String content) {
        return new ChatMessage(ChatRole.USER, content, null, null);
    }

    public static ChatMessage assistant(String content) {
        return new ChatMessage(ChatRole.ASSISTANT, content, null, null);
    }

    public static ChatMessage assistantToolCall(ToolCall call) {
        return new ChatMessage(ChatRole.ASSISTANT, null, call.name(), call);
    }

    public static ChatMessage tool(String toolName, String resultJson) {
        return new ChatMessage(ChatRole.TOOL, resultJson, toolName, null);
    }
}
