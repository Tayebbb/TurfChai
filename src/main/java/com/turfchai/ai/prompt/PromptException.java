package com.turfchai.ai.prompt;

public class PromptException extends RuntimeException {
    public PromptException(String message, Throwable cause) {
        super(message, cause);
    }

    public PromptException(String message) {
        super(message);
    }
}
