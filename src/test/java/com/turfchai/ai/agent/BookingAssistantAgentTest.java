package com.turfchai.ai.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.llm.ChatMessage;
import com.turfchai.ai.llm.ChatRole;
import com.turfchai.ai.llm.LlmRequest;
import com.turfchai.ai.llm.LlmResponse;
import com.turfchai.ai.llm.ToolCall;
import com.turfchai.ai.memory.InMemoryConversationMemory;
import com.turfchai.ai.prompt.PromptBuilder;
import com.turfchai.ai.prompt.PromptLoader;
import com.turfchai.ai.rag.ClasspathDocumentLoader;
import com.turfchai.ai.rag.HashingEmbeddingProvider;
import com.turfchai.ai.rag.InMemoryVectorStore;
import com.turfchai.ai.rag.KnowledgeRetriever;
import com.turfchai.ai.rag.TextChunker;
import com.turfchai.ai.state.InMemoryConversationStateStore;
import com.turfchai.ai.tool.ToolRegistry;
import com.turfchai.ai.tool.mock.BookingContextTool;
import com.turfchai.ai.tool.mock.MockBookingTool;
import com.turfchai.ai.tool.mock.MockVenueSearchTool;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingAssistantAgentTest {

    private ScriptedLlmProvider llm;
    private InMemoryConversationMemory memory;
    private InMemoryConversationStateStore stateStore;

    private BookingAssistantAgent agent;

    @BeforeEach
    void setUp() {
        llm = new ScriptedLlmProvider();
        memory = new InMemoryConversationMemory(30, 100);
        stateStore = new InMemoryConversationStateStore();

        ToolRegistry registry = new ToolRegistry(List.of(
                new MockVenueSearchTool(),
                new MockBookingTool(),
                new BookingContextTool(stateStore)));

        KnowledgeRetriever retriever = new KnowledgeRetriever(
                new ClasspathDocumentLoader(),
                new TextChunker(800, 120),
                new HashingEmbeddingProvider(),
                new InMemoryVectorStore(),
                4, 0.05);

        agent = new BookingAssistantAgent(
                llm, registry, retriever,
                new PromptBuilder(new PromptLoader()),
                memory, stateStore,
                new IntentRouter(), new AgentPlanner(),
                new ObjectMapper(), 3);
    }

    @Test
    void directTextAnswerFlow() {
        llm.enqueue(LlmResponse.ofText("Hi! How can I help you book a turf?"));

        AgentResponse response = agent.chat("s1", "u1", "hello");

        assertThat(response.reply()).contains("book a turf");
        assertThat(response.intent()).isEqualTo(Intent.SMALL_TALK);
        assertThat(response.toolsInvoked()).isEmpty();
        // memory captured the exchange
        assertThat(memory.history("s1")).hasSize(2);
    }

    @Test
    void toolCallRoundTripFlow() {
        llm.enqueue(LlmResponse.ofToolCalls(List.of(
                new ToolCall("search_venues", Map.of("area", "Banani", "sport", "football")))));
        llm.enqueue(LlmResponse.ofText("GreenTurf Arena in Banani is available at ৳2,500/hr."));

        AgentResponse response = agent.chat("s1", "u1", "book a football turf in banani");

        assertThat(response.toolsInvoked()).containsExactly("search_venues");
        assertThat(response.reply()).contains("GreenTurf Arena");
        // second LLM call must include the tool result message
        assertThat(llm.requests.get(1).messages())
                .anySatisfy(m -> {
                    assertThat(m.role()).isEqualTo(ChatRole.TOOL);
                    assertThat(m.content()).contains("GreenTurf Arena");
                });
    }

    @Test
    void bookingIntentScopesToolsToBookingSet() {
        llm.enqueue(LlmResponse.ofText("Sure — which area?"));

        agent.chat("s1", "u1", "I want to book a slot");

        assertThat(llm.requests.get(0).tools())
                .extracting(t -> t.name())
                .containsExactlyInAnyOrder("search_venues", "manage_booking", "update_booking_context");
    }

    @Test
    void policyQuestionUsesRetrievalAndNoTools() {
        llm.enqueue(LlmResponse.ofText("You get a 50% refund between 6 and 24 hours before start."));

        AgentResponse response = agent.chat("s1", "u1", "what is the cancellation refund policy?");

        assertThat(response.usedRetrieval()).isTrue();
        assertThat(llm.requests.get(0).tools()).isEmpty();
        // retrieved knowledge injected as a system message
        assertThat(llm.requests.get(0).messages())
                .anySatisfy(m -> {
                    assertThat(m.role()).isEqualTo(ChatRole.SYSTEM);
                    assertThat(m.content()).contains("refund");
                });
    }

    @Test
    void stateSummaryInjectedIntoSystemPrompt() {
        stateStore.get("s1").setSport("football");
        llm.enqueue(LlmResponse.ofText("Great, football it is."));

        agent.chat("s1", "u1", "I want to book");

        assertThat(llm.requests.get(0).messages().get(0).content())
                .contains("Current booking context")
                .contains("sport=football");
    }

    @Test
    void unknownToolRequestRecoversViaFailureResult() {
        llm.enqueue(LlmResponse.ofToolCalls(List.of(new ToolCall("hack_database", Map.of()))));
        llm.enqueue(LlmResponse.ofText("Sorry, I can't do that."));

        AgentResponse response = agent.chat("s1", "u1", "book something");

        assertThat(response.reply()).contains("Sorry");
        assertThat(llm.requests.get(1).messages())
                .anySatisfy(m -> {
                    assertThat(m.role()).isEqualTo(ChatRole.TOOL);
                    assertThat(m.content()).contains("Unknown tool");
                });
    }

    @Test
    void runawayToolLoopForcesFinalTextAnswer() {
        // maxToolIterations = 3; model keeps requesting tools
        for (int i = 0; i < 3; i++) {
            llm.enqueue(LlmResponse.ofToolCalls(List.of(
                    new ToolCall("search_venues", Map.of()))));
        }
        llm.enqueue(LlmResponse.ofText("Here is what I found so far."));

        AgentResponse response = agent.chat("s1", "u1", "book a turf");

        assertThat(response.reply()).contains("found so far");
        assertThat(response.toolsInvoked()).hasSize(3);
        // the forced final request must offer no tools
        LlmRequest finalRequest = llm.requests.get(llm.requests.size() - 1);
        assertThat(finalRequest.tools()).isEmpty();
        assertThat(finalRequest.messages())
                .anySatisfy(m -> assertThat(m.content()).contains("Tool budget exhausted"));
    }

    @Test
    void emptyModelReplyFails() {
        llm.enqueue(LlmResponse.ofText(""));

        assertThatThrownBy(() -> agent.chat("s1", "u1", "hello"))
                .isInstanceOf(AgentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void conversationHistoryIsSentOnSubsequentTurns() {
        llm.enqueue(LlmResponse.ofText("Hello!"));
        agent.chat("s1", "u1", "hi");

        llm.enqueue(LlmResponse.ofText("Football, got it."));
        agent.chat("s1", "u1", "I like football");

        List<ChatMessage> secondTurnMessages = llm.requests.get(1).messages();
        assertThat(secondTurnMessages)
                .anySatisfy(m -> assertThat(m.content()).isEqualTo("hi"))
                .anySatisfy(m -> assertThat(m.content()).isEqualTo("Hello!"));
    }
}
