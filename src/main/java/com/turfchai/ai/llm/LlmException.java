package com.turfchai.ai.llm;

public class LlmException extends RuntimeException {

    private final boolean retryable;

    public LlmException(String message) {
        this(message, null, false);
    }

    public LlmException(String message, Throwable cause, boolean retryable) {
        super(message, cause);
        this.retryable = retryable;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
