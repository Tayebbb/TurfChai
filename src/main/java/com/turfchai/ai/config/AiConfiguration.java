package com.turfchai.ai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.ai.agent.AgentPlanner;
import com.turfchai.ai.agent.BookingAssistantAgent;
import com.turfchai.ai.agent.IntentRouter;
import com.turfchai.ai.evaluation.AiMetricsRecorder;
import com.turfchai.ai.llm.FallbackLlmProvider;
import com.turfchai.ai.llm.LlmProvider;
import com.turfchai.ai.llm.OpenAiCompatibleLlmProvider;
import com.turfchai.ai.llm.UnconfiguredLlmProvider;
import com.turfchai.ai.memory.ConversationMemory;
import com.turfchai.ai.memory.InMemoryConversationMemory;
import com.turfchai.ai.prompt.PromptBuilder;
import com.turfchai.ai.prompt.PromptLoader;
import com.turfchai.ai.rag.ClasspathDocumentLoader;
import com.turfchai.ai.rag.EmbeddingProvider;
import com.turfchai.ai.rag.HashingEmbeddingProvider;
import com.turfchai.ai.rag.InMemoryVectorStore;
import com.turfchai.ai.rag.KnowledgeRetriever;
import com.turfchai.ai.rag.TextChunker;
import com.turfchai.ai.rag.VectorStore;
import com.turfchai.ai.state.ConversationStateStore;
import com.turfchai.ai.state.InMemoryConversationStateStore;
import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Wires the AI platform. Tools are {@code @Component}s under
 * {@code ai.tool.impl}, each holding the same application service its REST
 * controller uses, so the assistant and the app read one database.
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AiConfiguration.class);

    /** Boot 4 no longer auto-configures a bare ObjectMapper bean. */
    @Bean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    RestClient openRouterRestClient(AiProperties properties) {
        return buildRestClient(properties.getOpenrouter(), Map.of(
                // OpenRouter attribution headers (optional but recommended)
                "HTTP-Referer", "http://localhost:8080",
                "X-Title", "TurfChai"));
    }

    @Bean
    RestClient huggingFaceRestClient(AiProperties properties) {
        return buildRestClient(properties.getHuggingface(), Map.of());
    }

    private RestClient buildRestClient(AiProperties.Endpoint endpoint, Map<String, String> extraHeaders) {
        Duration timeout = Duration.ofSeconds(endpoint.getTimeoutSeconds());
        // JDK HttpClient: HTTP/2 + pooled keep-alive connections avoid a
        // fresh TLS handshake on every LLM round trip.
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .connectTimeout(timeout)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(timeout);
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(endpoint.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + endpoint.getApiKey())
                .requestFactory(requestFactory);
        extraHeaders.forEach(builder::defaultHeader);
        return builder.build();
    }

    /**
     * Provider chain ordered by {@code app.ai.primary-provider}, the other
     * key acting as fallback on retryable failures (quota/transport/5xx).
     * Either can run alone; with neither key set the app still boots and
     * chat returns 503.
     */
    @Bean
    LlmProvider llmProvider(AiProperties properties,
            RestClient openRouterRestClient,
            RestClient huggingFaceRestClient,
            ObjectMapper objectMapper) {
        LlmProvider openRouter = properties.getOpenrouter().getApiKey().isBlank() ? null
                : new OpenAiCompatibleLlmProvider("openrouter", openRouterRestClient,
                        objectMapper, properties.getOpenrouter());
        LlmProvider huggingFace = properties.getHuggingface().getApiKey().isBlank() ? null
                : new OpenAiCompatibleLlmProvider("huggingface", huggingFaceRestClient,
                        objectMapper, properties.getHuggingface());

        if (openRouter != null && huggingFace != null) {
            boolean hfFirst = "huggingface".equalsIgnoreCase(properties.getPrimaryProvider());
            LlmProvider primary = hfFirst ? huggingFace : openRouter;
            LlmProvider secondary = hfFirst ? openRouter : huggingFace;
            log.info("LLM providers: {} (primary) with {} fallback", primary.name(), secondary.name());
            return new FallbackLlmProvider(primary, secondary,
                    Duration.ofSeconds(properties.getAgent().getPrimaryCooldownSeconds()),
                    Clock.systemUTC());
        }
        if (openRouter != null) {
            log.info("LLM provider: openrouter only (no fallback configured)");
            return openRouter;
        }
        if (huggingFace != null) {
            log.info("LLM provider: huggingface only (OpenRouter key not set)");
            return huggingFace;
        }
        log.warn("No LLM API keys set — AI chat endpoints will return 503");
        return new UnconfiguredLlmProvider();
    }

    @Bean
    EmbeddingProvider embeddingProvider() {
        // OpenRouter has no embeddings API; the deterministic offline
        // hashing embedder serves the small policy/FAQ knowledge base well.
        return new HashingEmbeddingProvider();
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
                null,
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

    /**
     * Every {@link Tool} bean on the classpath. Registering by injection means
     * adding a capability is one new {@code @Component}, with no second place
     * to remember to update.
     */
    @Bean
    ToolRegistry toolRegistry(List<Tool> tools) {
        log.info("Registered {} AI tools: {}", tools.size(), tools.stream().map(t -> t.spec().name()).toList());
        return new ToolRegistry(tools);
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
