package com.turfchai.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * All AI-platform settings under the {@code app.ai} prefix.
 */
@ConfigurationProperties(prefix = "app.ai")
public class AiProperties {

    private final Gemini gemini = new Gemini();
    private final HuggingFace huggingface = new HuggingFace();
    private final Rag rag = new Rag();
    private final Memory memory = new Memory();
    private final Agent agent = new Agent();

    public Gemini getGemini() {
        return gemini;
    }

    public HuggingFace getHuggingface() {
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

    public static class Gemini {
        /** API key; when blank the app boots but chat requests return 503. */
        private String apiKey = "";
        private String model = "gemini-2.0-flash";
        private String embeddingModel = "gemini-embedding-001";
        private String baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        private int timeoutSeconds = 30;

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

        public String getEmbeddingModel() {
            return embeddingModel;
        }

        public void setEmbeddingModel(String embeddingModel) {
            this.embeddingModel = embeddingModel;
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
    }

    /** Fallback provider used when Gemini fails or hits its quota. */
    public static class HuggingFace {
        /** API key; when blank no fallback is registered. */
        private String apiKey = "";
        private String model = "meta-llama/Llama-3.3-70B-Instruct";
        /** OpenAI-compatible router endpoint. */
        private String baseUrl = "https://router.huggingface.co/v1";
        private int timeoutSeconds = 45;

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
        private int maxMessages = 30;
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
