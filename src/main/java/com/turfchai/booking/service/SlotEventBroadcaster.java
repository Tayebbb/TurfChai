package com.turfchai.booking.service;

import com.turfchai.booking.event.SlotStatusChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fans slot availability changes out to every browser currently watching that
 * venue/day, over Server-Sent Events.
 *
 * <p>SSE rather than WebSockets: the traffic is strictly server &rarr; client,
 * the app is on the servlet stack, and SSE needs no extra dependency and
 * survives ordinary HTTP proxies.
 *
 * <p><b>Delivery is after commit, never during.</b> {@link BookingService}
 * publishes the event inside its transaction and this listener runs at
 * {@link TransactionPhase#AFTER_COMMIT}. Broadcasting mid-transaction would
 * tell every connected browser a slot was taken and then leave them stale
 * forever if the transaction rolled back — there is no correcting event.
 *
 * <p><b>Capacity is accounted here, not by Spring's callbacks.</b> An emitter
 * that never reaches async initialization — an aborted request, a response
 * committed by an error handler first — never fires {@code onCompletion} or
 * {@code onError}, so a callback-only design leaks a permit every time. Leak
 * enough and the cap locks everyone out with no way back short of a restart.
 * Every exit path therefore releases the permit directly, and
 * {@link #reapStale()} sweeps anything that outlived its stream timeout as a
 * final backstop.
 *
 * <p>Broadcast is synchronous on the publishing thread. That is safe here:
 * events are rare (a hold or a booking, not a hot loop), payloads are a few
 * dozen bytes so they land in the socket buffer without blocking, a genuinely
 * dead peer surfaces as an exception which drops the subscription, and the
 * subscriber cap bounds the worst case. Adding an executor would buy nothing
 * but lifecycle complexity.
 */
@Component
@Slf4j
public class SlotEventBroadcaster {

    /**
     * Emitters are recycled on this cadence. {@code EventSource} reconnects by
     * itself, and each reconnect re-syncs from the REST snapshot, so this
     * doubles as a periodic correctness repair rather than pure housekeeping.
     */
    static final long STREAM_TIMEOUT_MS = 15 * 60 * 1000L;

    /** Bounds how many connections an unauthenticated caller can tie up. */
    static final int MAX_CONCURRENT_STREAMS = 500;

    /** Comment frames stop idle proxies from reaping an otherwise healthy stream. */
    static final long HEARTBEAT_MS = 25_000L;

    /** Slack past the stream timeout before the reaper treats a subscription as abandoned. */
    static final long REAP_GRACE_MS = 60_000L;

    private final Map<String, Set<Subscription>> channels = new ConcurrentHashMap<>();
    private final AtomicInteger activeStreams = new AtomicInteger();
    private final Clock clock;

    public SlotEventBroadcaster() {
        this(Clock.systemUTC());
    }

    /** Visible for tests, so reaping can be exercised without waiting 16 minutes. */
    SlotEventBroadcaster(Clock clock) {
        this.clock = clock;
    }

    /**
     * Registers a listener for one venue/day.
     *
     * @return the emitter to hand back to Spring MVC, or {@code null} when the
     *         server is already at capacity (the caller maps that to 503).
     */
    public SseEmitter subscribe(Long venueId, LocalDate date) {
        if (activeStreams.incrementAndGet() > MAX_CONCURRENT_STREAMS) {
            activeStreams.decrementAndGet();
            log.warn("Refusing slot stream for venue {} on {} — {} streams already open",
                    venueId, date, MAX_CONCURRENT_STREAMS);
            return null;
        }

        String channel = channelKey(venueId, date);
        Subscription subscription =
                new Subscription(channel, new SseEmitter(STREAM_TIMEOUT_MS), clock.millis());

        // Spring may fire more than one of these for the same emitter, so the
        // release must be idempotent or the permit count drifts and the cap
        // silently stops meaning anything.
        subscription.emitter.onCompletion(() -> release(subscription));
        subscription.emitter.onTimeout(() -> release(subscription));
        subscription.emitter.onError(error -> release(subscription));

        attach(channel, subscription);

        // Flushes response headers so the browser fires `onopen` immediately
        // instead of waiting for the first real change.
        try {
            subscription.emitter.send(SseEmitter.event().name("ready").data(Map.of(
                    "venueId", venueId,
                    "date", date.toString())));
        } catch (Exception e) {
            log.debug("Slot stream for venue {} closed before the ready frame: {}", venueId, e.toString());
            drop(subscription, e);
        }
        return subscription.emitter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSlotStatusChanged(SlotStatusChangedEvent event) {
        // An after-commit listener that throws is swallowed by the transaction
        // synchronizer, so a malformed event would vanish silently rather than
        // fail loudly — validate instead of trusting the publisher.
        if (event == null || event.venueId() == null || event.slotDate() == null || event.status() == null) {
            return;
        }
        Set<Subscription> subscribers = channels.get(channelKey(event.venueId(), event.slotDate()));
        if (subscribers == null || subscribers.isEmpty()) {
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("slotId", event.slotId());
        payload.put("venueId", event.venueId());
        payload.put("date", event.slotDate().toString());
        payload.put("status", event.status().name());
        payload.put("heldUntil", event.heldUntil() == null ? null : event.heldUntil().toString());

        for (Subscription subscription : subscribers) {
            dispatch(subscription, SseEmitter.event().name("slot").data(payload));
        }
    }

    @Scheduled(fixedRate = HEARTBEAT_MS)
    public void heartbeat() {
        reapStale();
        channels.forEach((channel, subscribers) -> {
            for (Subscription subscription : subscribers) {
                dispatch(subscription, SseEmitter.event().comment("keep-alive"));
            }
        });
    }

    /**
     * Backstop for subscriptions whose callbacks never fired. Without it a
     * permit lost to an aborted request stays lost until the process restarts.
     */
    void reapStale() {
        long cutoff = clock.millis() - (STREAM_TIMEOUT_MS + REAP_GRACE_MS);
        channels.forEach((channel, subscribers) -> {
            for (Subscription subscription : subscribers) {
                if (subscription.createdAtMs < cutoff) {
                    log.debug("Reaping abandoned slot stream on channel {}", channel);
                    drop(subscription, null);
                }
            }
        });
    }

    /** Visible for tests. */
    int activeStreamCount() {
        return activeStreams.get();
    }

    private void dispatch(Subscription subscription, SseEmitter.SseEventBuilder frame) {
        try {
            subscription.emitter.send(frame);
        } catch (Exception e) {
            // One dead peer must never abort the fan-out to everyone else, and
            // the permit is reclaimed here rather than waiting on a callback
            // that may never arrive.
            drop(subscription, e);
        }
    }

    /**
     * Releases the permit first, then closes the emitter; safe to call repeatedly.
     *
     * <p>Always completes normally, never {@code completeWithError}: the only
     * reason we drop a subscriber is that its peer has gone, and an errored
     * completion makes Spring re-dispatch the async request so the exception
     * resolvers run. The global handler then tries to render a JSON error into
     * a response already fixed to {@code text/event-stream} and logs a
     * {@code HttpMessageNotWritableException} stack trace — once per closed
     * browser tab. SSE has no error frame anyway; closing is the whole signal.
     */
    private void drop(Subscription subscription, Exception cause) {
        release(subscription);
        if (cause != null) {
            log.debug("Closing slot stream on channel {}: {}", subscription.channel, cause.toString());
        }
        try {
            subscription.emitter.complete();
        } catch (Exception ignored) {
            // Already completed, or the container has torn the request down.
        }
    }

    private void release(Subscription subscription) {
        if (subscription.released.compareAndSet(false, true)) {
            detach(subscription.channel, subscription);
            activeStreams.decrementAndGet();
        }
    }

    /**
     * {@code compute} serialises attach against detach on the same key, so an
     * empty channel can never be pruned between a subscriber creating it and
     * adding itself to it.
     */
    private void attach(String channel, Subscription subscription) {
        channels.compute(channel, (key, existing) -> {
            Set<Subscription> set = existing == null ? ConcurrentHashMap.newKeySet() : existing;
            set.add(subscription);
            return set;
        });
    }

    /** Drops the channel entirely once empty; venue/day keys are otherwise unbounded over time. */
    private void detach(String channel, Subscription subscription) {
        channels.compute(channel, (key, existing) -> {
            if (existing == null) {
                return null;
            }
            existing.remove(subscription);
            return existing.isEmpty() ? null : existing;
        });
    }

    private String channelKey(Long venueId, LocalDate date) {
        return venueId + "@" + date;
    }

    /** One connected browser. Identity equality is intended — every connection is distinct. */
    private static final class Subscription {
        private final String channel;
        private final SseEmitter emitter;
        private final long createdAtMs;
        private final AtomicBoolean released = new AtomicBoolean(false);

        private Subscription(String channel, SseEmitter emitter, long createdAtMs) {
            this.channel = channel;
            this.emitter = emitter;
            this.createdAtMs = createdAtMs;
        }
    }
}
