package com.turfchai.booking.event;

import com.turfchai.booking.entity.SlotStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Published whenever a slot's availability changes, so connected venue pages
 * can update without polling.
 *
 * <p>Deliberately carries only what a public viewer may see: the slot's
 * identity, which day it belongs to and its new status. {@code heldByUserId}
 * is never exposed — the stream is served on the public
 * {@code /api/v1/venues/**} path, so anything in here is world-readable.
 *
 * <p>{@code heldUntil} is only set for {@link SlotStatus#HELD} and lets a
 * client apply the same "a lapsed hold reads as available" rule that
 * {@code SlotRestController} applies to snapshots, instead of waiting up to
 * 30s for the cleanup job to publish the release.
 */
public record SlotStatusChangedEvent(
        Long slotId,
        Long venueId,
        LocalDate slotDate,
        SlotStatus status,
        OffsetDateTime heldUntil) {

    public static SlotStatusChangedEvent held(Long slotId, Long venueId, LocalDate slotDate,
            OffsetDateTime heldUntil) {
        return new SlotStatusChangedEvent(slotId, venueId, slotDate, SlotStatus.HELD, heldUntil);
    }

    public static SlotStatusChangedEvent of(Long slotId, Long venueId, LocalDate slotDate, SlotStatus status) {
        return new SlotStatusChangedEvent(slotId, venueId, slotDate, status, null);
    }
}
