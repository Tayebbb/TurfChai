package com.turfchai.ai.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.llm.ChatMessage;
import com.turfchai.ai.llm.LlmProvider;
import com.turfchai.ai.llm.LlmRequest;
import com.turfchai.ai.llm.LlmResponse;
import com.turfchai.ai.llm.ToolCall;
import com.turfchai.ai.memory.ConversationMemory;
import com.turfchai.ai.prompt.PromptBuilder;
import com.turfchai.ai.rag.KnowledgeRetriever;
import com.turfchai.ai.state.BookingState;
import com.turfchai.ai.state.ConversationStateStore;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolRegistry;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The orchestrator. One turn:
 *
 * <pre>
 * user message
 *   → intent routing → plan (RAG? which tools?)
 *   → prompt assembly (system + safety + role + state + retrieved knowledge)
 *   → LLM loop: model may request tool calls; results are fed back
 *   → final text reply; memory updated
 * </pre>
 *
 * The LLM never touches services or the database — only registered tools.
 */
public class BookingAssistantAgent {

    private static final Logger log = LoggerFactory.getLogger(BookingAssistantAgent.class);

    private final LlmProvider llmProvider;
    private final ToolRegistry toolRegistry;
    private final KnowledgeRetriever retriever;
    private final PromptBuilder promptBuilder;
    private final ConversationMemory memory;
    private final ConversationStateStore stateStore;
    private final IntentRouter intentRouter;
    private final AgentPlanner planner;
    private final ObjectMapper objectMapper;
    private final int maxToolIterations;

    public BookingAssistantAgent(LlmProvider llmProvider,
            ToolRegistry toolRegistry,
            KnowledgeRetriever retriever,
            PromptBuilder promptBuilder,
            ConversationMemory memory,
            ConversationStateStore stateStore,
            IntentRouter intentRouter,
            AgentPlanner planner,
            ObjectMapper objectMapper,
            int maxToolIterations) {
        this.llmProvider = llmProvider;
        this.toolRegistry = toolRegistry;
        this.retriever = retriever;
        this.promptBuilder = promptBuilder;
        this.memory = memory;
        this.stateStore = stateStore;
        this.intentRouter = intentRouter;
        this.planner = planner;
        this.objectMapper = objectMapper;
        this.maxToolIterations = maxToolIterations;
    }

    public AgentResponse chat(String sessionId, String userId, String userMessage) {
        return chat(sessionId, userId, null, userMessage);
    }

    /**
     * @param authenticatedUserId verified principal id, or null for an
     *                            anonymous visitor. Tools that read personal
     *                            data scope on this and nothing else.
     */
    public AgentResponse chat(String sessionId, String userId, Long authenticatedUserId, String userMessage) {
        long start = System.currentTimeMillis();

        Intent intent = intentRouter.route(userMessage);
        AgentPlan plan = planner.plan(intent);
        log.debug("session={} intent={} rag={} tools={}", sessionId, intent, plan.useRetrieval(), plan.allowedTools());

        List<ChatMessage> messages = assembleMessages(sessionId, userMessage, plan);
        List<ToolSpec> tools = toolRegistry.specs(plan.allowedTools());
        ToolContext toolContext = new ToolContext(sessionId, userId, authenticatedUserId);

        List<String> toolsInvoked = new ArrayList<>();
        Set<String> executedCalls = new HashSet<>();
        int totalTokens = 0;

        // Persist the user turn first so tool side effects and transcript
        // never diverge if a later LLM round-trip fails.
        memory.append(sessionId, ChatMessage.user(userMessage));

        LlmResponse response = llmProvider.chat(new LlmRequest(messages, tools));
        totalTokens += response.usage().total();

        int iterations = 0;
        boolean sawDuplicate = false;
        while (response.hasToolCalls()) {
            iterations++;
            for (ToolCall call : response.toolCalls()) {
                String callKey = call.name() + ":" + toJsonSafe(call.arguments());
                if (!executedCalls.add(callKey)) {
                    // Identical repeat: don't re-execute; nudge the model to answer.
                    sawDuplicate = true;
                    messages.add(ChatMessage.assistantToolCall(call));
                    messages.add(ChatMessage.tool(call.name(),
                            "{\"success\":false,\"error\":\"Duplicate call - you already have this result above. Answer the user now.\"}"));
                    continue;
                }
                toolsInvoked.add(call.name());
                ToolResult result = toolRegistry.execute(call.name(), call.arguments(), toolContext);
                messages.add(ChatMessage.assistantToolCall(call));
                messages.add(ChatMessage.tool(call.name(), toJson(result)));
            }
            if (iterations >= maxToolIterations || sawDuplicate) {
                // Force a final text answer: withhold tools so a tool-happy
                // model must summarize what it has instead of looping.
                log.warn("session={} forcing text answer (iterations={}, duplicate={})",
                        sessionId, iterations, sawDuplicate);
                messages.add(ChatMessage.system(
                        "Tool budget exhausted. Answer the user now using only the tool results above."));
                response = llmProvider.chat(new LlmRequest(messages, List.of()));
                totalTokens += response.usage().total();
                break;
            }
            response = llmProvider.chat(new LlmRequest(messages, tools));
            totalTokens += response.usage().total();
        }

        String reply = response.text();
        if (reply == null || reply.isBlank()) {
            throw new AgentException("Model returned an empty reply");
        }

        memory.append(sessionId, ChatMessage.assistant(reply));

        return new AgentResponse(reply, intent, List.copyOf(toolsInvoked),
                plan.useRetrieval(), System.currentTimeMillis() - start, totalTokens);
    }

    private List<ChatMessage> assembleMessages(String sessionId, String userMessage, AgentPlan plan) {
        List<ChatMessage> messages = new ArrayList<>();

        BookingState state = stateStore.get(sessionId);
        messages.add(ChatMessage.system(promptBuilder.buildSystemPrompt(
                state.isEmpty() ? null : state.summary(),
                !plan.allowedTools().isEmpty())));

        if (plan.useRetrieval()) {
            String context = retriever.retrieveAsContext(userMessage);
            if (!context.isBlank()) {
                messages.add(ChatMessage.system(promptBuilder.buildRetrievalContext(context)));
            }
        }

        messages.addAll(memory.history(sessionId));
        messages.add(ChatMessage.user(userMessage));
        return messages;
    }

    private String toJson(ToolResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize tool result", e);
            return "{\"success\":false,\"error\":\"internal serialization error\"}";
        }
    }

    private String toJsonSafe(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return String.valueOf(value);
        }
    }
}
