package com.turfchai.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * All AI-platform settings under the {@code app.ai} prefix.
 */
@ConfigurationProperties(prefix = "app.ai")
public class AiProperties {

    /** Which LLM is tried first: {@code openrouter} or {@code huggingface}. */
    private String primaryProvider = "openrouter";

    private final Endpoint openrouter = defaultOpenRouter();
    private final Endpoint huggingface = defaultHuggingFace();
    private final Rag rag = new Rag();
    private final Memory memory = new Memory();
    private final Agent agent = new Agent();

    private static Endpoint defaultOpenRouter() {
        Endpoint e = new Endpoint();
        e.setBaseUrl("https://openrouter.ai/api/v1");
        e.setModel("google/gemma-4-31b-it:free");
        e.setLatencyRouting(true);
        return e;
    }

    private static Endpoint defaultHuggingFace() {
        Endpoint e = new Endpoint();
        e.setBaseUrl("https://router.huggingface.co/v1");
        e.setModel("meta-llama/Llama-3.3-70B-Instruct");
        return e;
    }

    public String getPrimaryProvider() {
        return primaryProvider;
    }

    public void setPrimaryProvider(String primaryProvider) {
        this.primaryProvider = primaryProvider;
    }

    public Endpoint getOpenrouter() {
        return openrouter;
    }

    public Endpoint getHuggingface() {
        return huggingface;
    }

    public Rag getRag() {
        return rag;
    }

    public Memory getMemory() {
        return memory;
    }

    public Agent getAgent() {
        return agent;
    }

    /** Settings for one OpenAI-compatible chat-completions endpoint. */
    public static class Endpoint {
        /** API key; when blank the provider is not registered. */
        private String apiKey = "";
        private String model = "";
        /** Alternate models tried in order when the primary is rate-limited (OpenRouter routing). */
        private java.util.List<String> fallbackModels = java.util.List.of();
        /** When true, asks the gateway to route to the lowest-latency upstream (OpenRouter). */
        private boolean latencyRouting = false;
        private String baseUrl = "";
        private int timeoutSeconds = 45;
        /** Low temperature keeps tool arguments and policy answers precise. */
        private double temperature = 0.3;
        /** Nucleus sampling cap. */
        private double topP = 0.9;
        /** Reply length cap — keeps answers chat-sized and saves credits. */
        private int maxTokens = 450;

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public java.util.List<String> getFallbackModels() {
            return fallbackModels;
        }

        public void setFallbackModels(java.util.List<String> fallbackModels) {
            this.fallbackModels = fallbackModels;
        }

        public boolean isLatencyRouting() {
            return latencyRouting;
        }

        public void setLatencyRouting(boolean latencyRouting) {
            this.latencyRouting = latencyRouting;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public int getTimeoutSeconds() {
            return timeoutSeconds;
        }

        public void setTimeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
        }

        public double getTemperature() {
            return temperature;
        }

        public void setTemperature(double temperature) {
            this.temperature = temperature;
        }

        public double getTopP() {
            return topP;
        }

        public void setTopP(double topP) {
            this.topP = topP;
        }

        public int getMaxTokens() {
            return maxTokens;
        }

        public void setMaxTokens(int maxTokens) {
            this.maxTokens = maxTokens;
        }
    }

    public static class Rag {
        private int chunkSize = 800;
        private int chunkOverlap = 120;
        private int topK = 4;
        /** Minimum cosine similarity for a chunk to be considered relevant. */
        private double minScore = 0.05;

        public int getChunkSize() {
            return chunkSize;
        }

        public void setChunkSize(int chunkSize) {
            this.chunkSize = chunkSize;
        }

        public int getChunkOverlap() {
            return chunkOverlap;
        }

        public void setChunkOverlap(int chunkOverlap) {
            this.chunkOverlap = chunkOverlap;
        }

        public int getTopK() {
            return topK;
        }

        public void setTopK(int topK) {
            this.topK = topK;
        }

        public double getMinScore() {
            return minScore;
        }

        public void setMinScore(double minScore) {
            this.minScore = minScore;
        }
    }

    public static class Memory {
        /** Max messages retained per conversation session. */
        private int maxMessages = 20;
        /** Max concurrent sessions kept in memory. */
        private int maxSessions = 1000;

        public int getMaxMessages() {
            return maxMessages;
        }

        public void setMaxMessages(int maxMessages) {
            this.maxMessages = maxMessages;
        }

        public int getMaxSessions() {
            return maxSessions;
        }

        public void setMaxSessions(int maxSessions) {
            this.maxSessions = maxSessions;
        }
    }

    public static class Agent {
        /** Safety cap on LLM->tool->LLM round-trips per user message. */
        private int maxToolIterations = 4;
        /** How long to skip a failed primary LLM before retrying it. */
        private int primaryCooldownSeconds = 60;

        public int getMaxToolIterations() {
            return maxToolIterations;
        }

        public void setMaxToolIterations(int maxToolIterations) {
            this.maxToolIterations = maxToolIterations;
        }

        public int getPrimaryCooldownSeconds() {
            return primaryCooldownSeconds;
        }

        public void setPrimaryCooldownSeconds(int primaryCooldownSeconds) {
            this.primaryCooldownSeconds = primaryCooldownSeconds;
        }
    }
}
