package com.turfchai.booking.service;

import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.event.SlotStatusChangedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class SlotEventBroadcasterTest {

    private static final Long VENUE_ID = 12L;
    private static final LocalDate DATE = LocalDate.of(2026, 8, 20);

    private SlotEventBroadcaster broadcaster;

    @BeforeEach
    void setUp() {
        broadcaster = new SlotEventBroadcaster();
    }

    @Test
    @DisplayName("subscribing hands back an emitter and counts it against the cap")
    void subscribe_registersEmitter() {
        SseEmitter emitter = broadcaster.subscribe(VENUE_ID, DATE);

        assertNotNull(emitter);
        assertEquals(1, broadcaster.activeStreamCount());
    }

    @Test
    @DisplayName("subscriptions are refused once the cap is reached, rather than exhausting connections")
    void subscribe_refusesBeyondCap() {
        List<SseEmitter> accepted = new ArrayList<>();
        for (int i = 0; i < SlotEventBroadcaster.MAX_CONCURRENT_STREAMS; i++) {
            accepted.add(broadcaster.subscribe(VENUE_ID, DATE));
        }

        assertEquals(SlotEventBroadcaster.MAX_CONCURRENT_STREAMS, accepted.size());
        assertEquals(SlotEventBroadcaster.MAX_CONCURRENT_STREAMS, broadcaster.activeStreamCount());
        assertNull(broadcaster.subscribe(VENUE_ID, DATE), "cap must be a hard limit");
        // A refused subscription must not consume a slot on the way out.
        assertEquals(SlotEventBroadcaster.MAX_CONCURRENT_STREAMS, broadcaster.activeStreamCount());
    }

    @Test
    @DisplayName("an abandoned stream's capacity is reclaimed by the reaper, not leaked forever")
    void reap_releasesAbandonedStreams() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-20T10:00:00Z"));
        SlotEventBroadcaster reaping = new SlotEventBroadcaster(clock);
        reaping.subscribe(VENUE_ID, DATE);
        assertEquals(1, reaping.activeStreamCount());

        reaping.reapStale();
        assertEquals(1, reaping.activeStreamCount(), "a live stream must survive the sweep");

        clock.advance(Duration.ofMillis(
                SlotEventBroadcaster.STREAM_TIMEOUT_MS + SlotEventBroadcaster.REAP_GRACE_MS + 1));
        reaping.reapStale();
        assertEquals(0, reaping.activeStreamCount());

        // Sweeping again must not double-release and drive the count negative,
        // which would silently raise the effective cap.
        reaping.reapStale();
        assertEquals(0, reaping.activeStreamCount());
    }

    @Test
    @DisplayName("writing to a closed subscriber reclaims its capacity immediately")
    void dispatch_toClosedSubscriber_reclaimsCapacity() {
        SseEmitter emitter = broadcaster.subscribe(VENUE_ID, DATE);
        emitter.complete();
        assertEquals(1, broadcaster.activeStreamCount());

        broadcaster.onSlotStatusChanged(SlotStatusChangedEvent.of(1L, VENUE_ID, DATE, SlotStatus.BOOKED));

        assertEquals(0, broadcaster.activeStreamCount(),
                "a failed write must reclaim the permit rather than wait on a callback");
    }

    @Test
    @DisplayName("an event for a channel nobody is watching is a no-op")
    void broadcast_toEmptyChannel_isNoop() {
        assertDoesNotThrow(() -> broadcaster.onSlotStatusChanged(
                SlotStatusChangedEvent.of(1L, VENUE_ID, DATE, SlotStatus.BOOKED)));
    }

    @Test
    @DisplayName("an event for another venue or day never reaches this channel's subscribers")
    void broadcast_isScopedToVenueAndDate() {
        broadcaster.subscribe(VENUE_ID, DATE);

        assertDoesNotThrow(() -> {
            broadcaster.onSlotStatusChanged(
                    SlotStatusChangedEvent.of(1L, 999L, DATE, SlotStatus.BOOKED));
            broadcaster.onSlotStatusChanged(
                    SlotStatusChangedEvent.of(1L, VENUE_ID, DATE.plusDays(1), SlotStatus.BOOKED));
        });
        // Neither event matched a channel, so nothing was written and the
        // subscriber is still live.
        assertEquals(1, broadcaster.activeStreamCount());
    }

    @Test
    @DisplayName("events with no venue or date are dropped instead of fanning out everywhere")
    void broadcast_ignoresIncompleteEvents() {
        broadcaster.subscribe(VENUE_ID, DATE);

        assertDoesNotThrow(() -> {
            broadcaster.onSlotStatusChanged(
                    new SlotStatusChangedEvent(1L, null, DATE, SlotStatus.HELD, OffsetDateTime.now()));
            broadcaster.onSlotStatusChanged(
                    new SlotStatusChangedEvent(1L, VENUE_ID, null, SlotStatus.HELD, OffsetDateTime.now()));
        });
        assertEquals(1, broadcaster.activeStreamCount());
    }

    @Test
    @DisplayName("heartbeats survive an already-completed subscriber")
    void heartbeat_toleratesDeadSubscribers() {
        SseEmitter emitter = broadcaster.subscribe(VENUE_ID, DATE);
        emitter.complete();

        assertDoesNotThrow(() -> broadcaster.heartbeat());
        assertEquals(0, broadcaster.activeStreamCount());
    }

    /** Lets the reaper be tested without waiting out a 15-minute stream timeout. */
    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration amount) {
            instant = instant.plus(amount);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
