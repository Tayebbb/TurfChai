import { useEffect, useRef } from 'react';
import { apiUrl } from '@/api/client';

/**
 * Live slot availability for one venue/day over Server-Sent Events.
 *
 * The stream carries changes, not state: anything published while the browser
 * was disconnected is gone. So every *re*connection fires `onResync`, which the
 * caller uses to re-read the authoritative snapshot. The first connection does
 * not, because the caller has just fetched it.
 *
 * A `HELD` change also carries `heldUntil`. When that passes with no further
 * change, the hook synthesises `AVAILABLE` itself — mirroring the same
 * "a lapsed hold reads as available" rule the REST snapshot applies — instead
 * of leaving the grid wrong for up to the 30s cleanup-job cadence.
 */

/** setTimeout saturates past ~24.8 days; holds are minutes, so clamp defensively. */
const MAX_TIMER_MS = 10 * 60 * 1000;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
/** The server refuses new streams at capacity; stop rather than hammer it. */
const MAX_RECONNECT_ATTEMPTS = 5;

const VALID_STATUSES = new Set(['AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED']);

export function useSlotStream({ venueId, date, enabled = true, onSlotChange, onResync }) {
  // Latest-ref pattern: callers pass inline callbacks, and re-subscribing on
  // every render would tear the connection down continuously.
  const slotChangeRef = useRef(onSlotChange);
  const resyncRef = useRef(onResync);
  useEffect(() => {
    slotChangeRef.current = onSlotChange;
    resyncRef.current = onResync;
  });

  useEffect(() => {
    if (!enabled || !venueId || !date) return undefined;
    if (typeof window === 'undefined' || typeof window.EventSource !== 'function') return undefined;

    const url = apiUrl(
      `/api/v1/venues/${encodeURIComponent(venueId)}/slots/stream?date=${encodeURIComponent(date)}`,
    );

    let source = null;
    let disposed = false;
    let openedOnce = false;
    let attempts = 0;
    let reconnectTimer = null;
    /** slotId -> timeout that flips a lapsed hold back to available. */
    const expiryTimers = new Map();

    const clearExpiry = (slotId) => {
      const timer = expiryTimers.get(slotId);
      if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(slotId);
      }
    };

    const emit = (change) => {
      if (disposed) return;
      slotChangeRef.current?.(change);
    };

    const handleSlotFrame = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return; // malformed frame — ignore rather than crash the page
      }
      if (!payload || typeof payload !== 'object') return;

      const slotId = Number(payload.slotId);
      const status = String(payload.status ?? '');
      if (!Number.isFinite(slotId) || !VALID_STATUSES.has(status)) return;
      // The server already scopes each channel, but never trust the frame.
      if (String(payload.venueId) !== String(venueId) || String(payload.date) !== String(date)) return;

      clearExpiry(slotId);
      emit({ slotId, status });

      if (status !== 'HELD' || !payload.heldUntil) return;
      const lapsesIn = new Date(payload.heldUntil).getTime() - Date.now();
      if (Number.isNaN(lapsesIn)) return;
      if (lapsesIn <= 0) {
        emit({ slotId, status: 'AVAILABLE' });
        return;
      }
      expiryTimers.set(
        slotId,
        setTimeout(() => {
          expiryTimers.delete(slotId);
          emit({ slotId, status: 'AVAILABLE' });
        }, Math.min(lapsesIn, MAX_TIMER_MS)),
      );
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource(url);

      source.onopen = () => {
        attempts = 0;
        if (openedOnce) resyncRef.current?.();
        openedOnce = true;
      };

      source.addEventListener('slot', handleSlotFrame);

      source.onerror = () => {
        // readyState CONNECTING means the browser is already retrying on its
        // own; only take over once it has given up (CLOSED), which is what a
        // non-2xx response produces.
        if (disposed || !source || source.readyState !== EventSource.CLOSED) return;
        source.close();
        source = null;
        if (attempts >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      expiryTimers.forEach((timer) => clearTimeout(timer));
      expiryTimers.clear();
      if (source) {
        source.onopen = null;
        source.onerror = null;
        source.close();
      }
    };
  }, [venueId, date, enabled]);
}
