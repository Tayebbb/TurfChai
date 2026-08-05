package com.turfchai.ai.api;

import com.turfchai.ai.agent.AgentException;
import com.turfchai.ai.llm.LlmException;
import com.turfchai.ai.prompt.PromptException;
import com.turfchai.ai.rag.RagException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Maps AI-module failures to safe, consistent API errors (scoped to this
 * package's controllers).
 */
@RestControllerAdvice(basePackages = "com.turfchai.ai.api")
public class AiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(AiExceptionHandler.class);

    @ExceptionHandler(LlmException.class)
    public ResponseEntity<Map<String, String>> handleLlm(LlmException e) {
        log.error("LLM failure", e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "The AI assistant is temporarily unavailable. Please try again."));
    }

    @ExceptionHandler(AgentException.class)
    public ResponseEntity<Map<String, String>> handleAgent(AgentException e) {
        log.error("Agent failure", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "The AI assistant could not complete that request."));
    }

    @ExceptionHandler({ RagException.class, PromptException.class })
    public ResponseEntity<Map<String, String>> handleInternal(RuntimeException e) {
        log.error("AI internal failure", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "The AI assistant could not complete that request."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .findFirst()
                .orElse("invalid request");
        return ResponseEntity.badRequest().body(Map.of("error", detail));
    }
}
