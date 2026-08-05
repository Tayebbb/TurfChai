package com.turfchai.ai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.agent.AgentPlanner;
import com.turfchai.ai.agent.BookingAssistantAgent;
import com.turfchai.ai.agent.IntentRouter;
import com.turfchai.ai.evaluation.AiMetricsRecorder;
import com.turfchai.ai.llm.GeminiLlmProvider;
import com.turfchai.ai.llm.LlmProvider;
import com.turfchai.ai.llm.UnconfiguredLlmProvider;
import com.turfchai.ai.memory.ConversationMemory;
import com.turfchai.ai.memory.InMemoryConversationMemory;
import com.turfchai.ai.prompt.PromptBuilder;
import com.turfchai.ai.prompt.PromptLoader;
import com.turfchai.ai.rag.ClasspathDocumentLoader;
import com.turfchai.ai.rag.EmbeddingProvider;
import com.turfchai.ai.rag.GeminiEmbeddingProvider;
import com.turfchai.ai.rag.HashingEmbeddingProvider;
import com.turfchai.ai.rag.InMemoryVectorStore;
import com.turfchai.ai.rag.KnowledgeRetriever;
import com.turfchai.ai.rag.TextChunker;
import com.turfchai.ai.rag.VectorStore;
import com.turfchai.ai.state.ConversationStateStore;
import com.turfchai.ai.state.InMemoryConversationStateStore;
import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolRegistry;
import com.turfchai.ai.tool.mock.BookingContextTool;
import com.turfchai.ai.tool.mock.MockBookingTool;
import com.turfchai.ai.tool.mock.MockPaymentTool;
import com.turfchai.ai.tool.mock.MockTournamentTool;
import com.turfchai.ai.tool.mock.MockUserProfileTool;
import com.turfchai.ai.tool.mock.MockVenueSearchTool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

/**
 * Wires the AI platform. Mock tools are explicit beans here; when real
 * backend services land, replace the mock bean definitions — the agent,
 * registry and API stay untouched.
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AiConfiguration.class);

    @Bean
    RestClient geminiRestClient(AiProperties properties) {
        Duration timeout = Duration.ofSeconds(properties.getGemini().getTimeoutSeconds());
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);
        return RestClient.builder()
                .baseUrl(properties.getGemini().getBaseUrl())
                .defaultHeader("x-goog-api-key", properties.getGemini().getApiKey())
                .requestFactory(requestFactory)
                .build();
    }

    @Bean
    LlmProvider llmProvider(AiProperties properties, RestClient geminiRestClient, ObjectMapper objectMapper) {
        if (properties.getGemini().getApiKey().isBlank()) {
            log.warn("app.ai.gemini.api-key not set — AI chat endpoints will return 503");
            return new UnconfiguredLlmProvider();
        }
        return new GeminiLlmProvider(geminiRestClient, objectMapper, properties.getGemini());
    }

    @Bean
    EmbeddingProvider embeddingProvider(AiProperties properties, RestClient geminiRestClient) {
        if (properties.getGemini().getApiKey().isBlank()) {
            log.warn("app.ai.gemini.api-key not set — using offline hashing embeddings for RAG");
            return new HashingEmbeddingProvider();
        }
        return new GeminiEmbeddingProvider(geminiRestClient, properties.getGemini());
    }

    @Bean
    VectorStore vectorStore() {
        return new InMemoryVectorStore();
    }

    @Bean
    KnowledgeRetriever knowledgeRetriever(AiProperties properties,
            EmbeddingProvider embeddingProvider,
            VectorStore vectorStore) {
        AiProperties.Rag rag = properties.getRag();
        return new KnowledgeRetriever(
                new ClasspathDocumentLoader(),
                new TextChunker(rag.getChunkSize(), rag.getChunkOverlap()),
                embeddingProvider,
                vectorStore,
                rag.getTopK(),
                rag.getMinScore());
    }

    @Bean
    PromptBuilder promptBuilder() {
        return new PromptBuilder(new PromptLoader());
    }

    @Bean
    ConversationMemory conversationMemory(AiProperties properties) {
        return new InMemoryConversationMemory(
                properties.getMemory().getMaxMessages(),
                properties.getMemory().getMaxSessions());
    }

    @Bean
    ConversationStateStore conversationStateStore() {
        return new InMemoryConversationStateStore();
    }

    @Bean
    ToolRegistry toolRegistry(ConversationStateStore stateStore) {
        return new ToolRegistry(List.<Tool>of(
                new MockVenueSearchTool(),
                new MockBookingTool(),
                new MockUserProfileTool(),
                new MockPaymentTool(),
                new MockTournamentTool(),
                new BookingContextTool(stateStore)));
    }

    @Bean
    AiMetricsRecorder aiMetricsRecorder() {
        return new AiMetricsRecorder();
    }

    @Bean
    BookingAssistantAgent bookingAssistantAgent(LlmProvider llmProvider,
            ToolRegistry toolRegistry,
            KnowledgeRetriever knowledgeRetriever,
            PromptBuilder promptBuilder,
            ConversationMemory conversationMemory,
            ConversationStateStore conversationStateStore,
            ObjectMapper objectMapper,
            AiProperties properties) {
        return new BookingAssistantAgent(
                llmProvider,
                toolRegistry,
                knowledgeRetriever,
                promptBuilder,
                conversationMemory,
                conversationStateStore,
                new IntentRouter(),
                new AgentPlanner(),
                objectMapper,
                properties.getAgent().getMaxToolIterations());
    }
}
