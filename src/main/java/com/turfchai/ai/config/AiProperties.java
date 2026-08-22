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
        // Must advertise `tools` in OpenRouter's model catalogue. A model
        // without function calling answers "I don't have that information"
        // about data the tools hold, and a reasoning model leaks its thinking
        // into `content` instead of emitting a tool call.
        e.setModel("meta-llama/llama-3.3-70b-instruct:free");
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
        /**
         * Primary API key (single-key backward-compatible). When {@link #apiKeys} is
         * also set, all keys are pooled and rotated automatically on quota exhaustion.
         */
        private String apiKey = "";

        /**
         * Additional API keys for automatic rotation. When any key hits its daily
         * quota (HTTP 429/402) the next key in the list is tried transparently.
         * In .env, set as a comma-separated value:
         * <pre>
         *   OPENROUTER_API_KEYS=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3
         * </pre>
         */
        private java.util.List<String> apiKeys = java.util.List.of();

        private String model = "";
        /**
         * Alternate models tried in order when the primary is rate-limited (OpenRouter
         * routing).
         */
        private java.util.List<String> fallbackModels = java.util.List.of();
        /**
         * When true, asks the gateway to route to the lowest-latency upstream
         * (OpenRouter).
         */
        private boolean latencyRouting = false;
        private String baseUrl = "";
        private int timeoutSeconds = 45;
        /** Low temperature keeps tool arguments and policy answers precise. */
        private double temperature = 0.3;
        /** Nucleus sampling cap. */
        private double topP = 0.9;
        /** Reply length cap — keeps answers chat-sized and saves credits. */
        private int maxTokens = 450;

        /**
         * Returns all effective API keys: the {@code apiKey} singleton plus every
         * entry from {@code apiKeys}, deduplicated and filtered for blank entries.
         * This is the list the provider pool rotates through.
         */
        public java.util.List<String> getEffectiveApiKeys() {
            java.util.LinkedHashSet<String> all = new java.util.LinkedHashSet<>();
            if (!apiKey.isBlank()) {
                for (String part : apiKey.split(",")) {
                    String trimmed = part.trim();
                    if (!trimmed.isBlank()) {
                        all.add(trimmed);
                    }
                }
            }
            for (String k : apiKeys) {
                // apiKeys may be a single comma-separated string if set via env var
                for (String part : k.split(",")) {
                    String trimmed = part.trim();
                    if (!trimmed.isBlank()) {
                        all.add(trimmed);
                    }
                }
            }
            return java.util.List.copyOf(all);
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public java.util.List<String> getApiKeys() {
            return apiKeys;
        }

        public void setApiKeys(java.util.List<String> apiKeys) {
            this.apiKeys = apiKeys;
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
