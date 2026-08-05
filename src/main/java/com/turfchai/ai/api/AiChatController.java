package com.turfchai.ai.api;

import com.turfchai.ai.agent.AgentResponse;
import com.turfchai.ai.agent.BookingAssistantAgent;
import com.turfchai.ai.evaluation.AiMetricsRecorder;
import com.turfchai.ai.memory.ConversationMemory;
import com.turfchai.ai.state.ConversationStateStore;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private final BookingAssistantAgent agent;
    private final ConversationMemory memory;
    private final ConversationStateStore stateStore;
    private final AiMetricsRecorder metrics;
    private final SimpleRateLimiter rateLimiter = new SimpleRateLimiter(20, 60_000, Clock.systemUTC());
    /** Temporary session→user binding until real authentication lands. */
    private final Map<String, String> sessionOwners = new ConcurrentHashMap<>();

    public AiChatController(BookingAssistantAgent agent,
            ConversationMemory memory,
            ConversationStateStore stateStore,
            AiMetricsRecorder metrics) {
        this.agent = agent;
        this.memory = memory;
        this.stateStore = stateStore;
        this.metrics = metrics;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        String sessionId = request.sessionId() == null || request.sessionId().isBlank()
                ? UUID.randomUUID().toString()
                : request.sessionId();
        String userId = request.userId() == null ? "" : request.userId();

        // Bind the session to its first user so one caller cannot hijack
        // another caller's session transcript/state.
        if (sessionOwners.size() > 10_000) {
            sessionOwners.clear();   // crude cap until auth + server-side sessions land
        }
        String owner = sessionOwners.computeIfAbsent(sessionId, k -> userId);
        if (!Objects.equals(owner, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to this user");
        }

        if (!rateLimiter.tryAcquire(sessionId)) {
            metrics.recordFailure("RateLimited");
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
        }

        try {
            AgentResponse response = agent.chat(sessionId, userId, request.message());
            metrics.recordSuccess(response);
            return ResponseEntity.ok(new ChatResponse(
                    sessionId,
                    response.reply(),
                    response.intent().name(),
                    response.toolsInvoked(),
                    response.latencyMs()));
        } catch (RuntimeException e) {
            metrics.recordFailure(e.getClass().getSimpleName());
            throw e;
        }
    }

    /** Resets both transcript and structured state for a session. */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> resetSession(@PathVariable String sessionId) {
        memory.clear(sessionId);
        stateStore.clear(sessionId);
        sessionOwners.remove(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/metrics")
    public ResponseEntity<AiMetricsRecorder.Snapshot> metrics() {
        return ResponseEntity.ok(metrics.snapshot());
    }
}
