package com.turfchai.ai.evaluation;

import com.turfchai.ai.agent.AgentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Lightweight in-process metrics for AI quality/cost monitoring:
 * request count, failures, latency, token spend and tool usage.
 * Exposed as a snapshot; wire into Micrometer when observability lands.
 */
public class AiMetricsRecorder {

    private static final Logger log = LoggerFactory.getLogger(AiMetricsRecorder.class);

    private final AtomicLong requests = new AtomicLong();
    private final AtomicLong failures = new AtomicLong();
    private final AtomicLong totalLatencyMs = new AtomicLong();
    private final AtomicLong totalTokens = new AtomicLong();
    private final AtomicLong totalToolCalls = new AtomicLong();

    public void recordSuccess(AgentResponse response) {
        requests.incrementAndGet();
        totalLatencyMs.addAndGet(response.latencyMs());
        totalTokens.addAndGet(response.totalTokens());
        totalToolCalls.addAndGet(response.toolsInvoked().size());
        log.info("ai-chat ok intent={} latencyMs={} tokens={} tools={}",
                response.intent(), response.latencyMs(), response.totalTokens(), response.toolsInvoked());
    }

    public void recordFailure(String reason) {
        requests.incrementAndGet();
        failures.incrementAndGet();
        log.warn("ai-chat failed reason={}", reason);
    }

    public Snapshot snapshot() {
        long count = requests.get();
        return new Snapshot(
                count,
                failures.get(),
                count == 0 ? 0 : totalLatencyMs.get() / count,
                totalTokens.get(),
                totalToolCalls.get());
    }

    public record Snapshot(long requests, long failures, long avgLatencyMs,
            long totalTokens, long totalToolCalls) {
    }
}
