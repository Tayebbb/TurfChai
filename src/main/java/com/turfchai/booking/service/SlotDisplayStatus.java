package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;

import java.time.OffsetDateTime;

/**
 * Computes the status a slot should be *displayed* as, correcting for a hold
 * whose {@code holdExpiresAt} has already lapsed but that the async
 * {@link SlotHoldCleanupJob} (30s cadence) hasn't caught up and persisted as
 * AVAILABLE yet.
 *
 * <p>Every read path that surfaces slot status to a client (player-facing
 * REST, owner-facing REST, SSE snapshots, etc.) must go through this so a
 * lapsed hold never reads as "held"/"started" purely because the cleanup job
 * hasn't run yet.
 */
public final class SlotDisplayStatus {

    private SlotDisplayStatus() {
    }

    public static String of(Slot slot) {
        if (slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(OffsetDateTime.now())) {
            return SlotStatus.AVAILABLE.name();
        }
        return slot.getStatus() != null ? slot.getStatus().name() : null;
    }
}
