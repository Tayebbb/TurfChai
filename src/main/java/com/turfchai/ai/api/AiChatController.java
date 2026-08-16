package com.turfchai.ai.api;

import com.turfchai.ai.agent.AgentResponse;
import com.turfchai.ai.agent.BookingAssistantAgent;
import com.turfchai.ai.evaluation.AiMetricsRecorder;
import com.turfchai.ai.memory.ConversationMemory;
import com.turfchai.ai.state.ConversationStateStore;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    public ResponseEntity<ChatResponse> chat(
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal principal,
            @Valid @RequestBody ChatRequest request) {
        String sessionId = request.sessionId() == null || request.sessionId().isBlank()
                ? UUID.randomUUID().toString()
                : request.sessionId();
        // A signed-in caller is identified by their token, never by the body:
        // the request field is only a label for anonymous visitors.
        String userId = callerId(principal, request.userId());

        // Bind the session to its first user so one caller cannot hijack
        // another caller's session transcript/state.
        if (sessionOwners.size() > 10_000) {
            sessionOwners.clear(); // crude cap until auth + server-side sessions land
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
    public ResponseEntity<Void> resetSession(
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal principal,
            @PathVariable String sessionId) {
        // Without this check any caller could wipe any transcript by guessing
        // a session id, since ids are client-supplied strings.
        String owner = sessionOwners.get(sessionId);
        if (owner != null && !Objects.equals(owner, callerId(principal, null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to this user");
        }
        memory.clear(sessionId);
        stateStore.clear(sessionId);
        sessionOwners.remove(sessionId);
        return ResponseEntity.noContent().build();
    }

    /** Token identity wins; the body value is a fallback for anonymous chat. */
    private String callerId(com.turfchai.security.UserPrincipal principal, String fromBody) {
        if (principal != null && principal.getId() != null) {
            return "user:" + principal.getId();
        }
        return fromBody == null ? "" : fromBody;
    }

    @GetMapping("/metrics")
    public ResponseEntity<AiMetricsRecorder.Snapshot> metrics() {
        return ResponseEntity.ok(metrics.snapshot());
    }
}
