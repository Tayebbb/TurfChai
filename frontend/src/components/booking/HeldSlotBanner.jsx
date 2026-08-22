import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveHold, releaseHold } from '@/api/bookings';
import { getToken } from '@/api/client';
import { paths } from '@/routes/paths';
import './HeldSlotBanner.css';

const POLL_MS = 20000;
const HOLD_KEY = (slotId) => `slot_hold_${slotId}`;
const clearHold = (slotId) => sessionStorage.removeItem(HOLD_KEY(slotId));

const secondsUntil = (heldUntil) =>
  Math.max(0, Math.round((new Date(heldUntil).getTime() - Date.now()) / 1000));

/** `125` -> `"2:05"` */
function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Floating, app-wide reminder that the player has a slot on hold somewhere.
 * Without this, navigating away from checkout (back button, closing the
 * tab, tapping into another venue) left no trace of an in-progress booking
 * anywhere else in the app — the countdown just ran out silently. Polls
 * GET /bookings/active-hold rather than relying on CheckoutPage's own state,
 * so it surfaces the hold from any screen, not just the one that created it.
 */
export function HeldSlotBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hold, setHold] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);

  const signedIn = Boolean(getToken());

  useEffect(() => {
    // Signed out: nothing to poll. `hold` is left as-is rather than cleared
    // here — setting state synchronously in an effect body just to reset it
    // triggers an extra cascading render for no visible benefit, since the
    // render below already gates on `signedIn` and won't show a stale hold.
    if (!signedIn) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await getActiveHold();
        if (!cancelled) setHold(result?.slotId ? result : null);
      } catch {
        // Transient failure — the next poll tries again; nothing to show meanwhile.
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Re-poll on navigation so acquiring/releasing a hold on one page (e.g.
    // paying, or the checkout page's own hold) reflects here promptly.
  }, [signedIn, location.pathname]);

  // Local 1s ticker for the countdown text; the poll above stays the source
  // of truth for whether the hold still exists at all.
  useEffect(() => {
    if (!hold) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hold]);

  // Guards against a stale hold rendering right after sign-out, since the
  // effect above deliberately doesn't clear `hold` synchronously on sign-out.
  if (!signedIn || !hold) return null;

  const secondsLeft = secondsUntil(hold.heldUntil);
  if (secondsLeft <= 0) return null;

  const checkoutHref = hold.venueSlug
    ? `${paths.player.checkout}?slotId=${hold.slotId}&venue=${encodeURIComponent(hold.venueSlug)}&date=${encodeURIComponent(hold.slotDate ?? '')}`
    : `${paths.player.checkout}?slotId=${hold.slotId}`;

  // Hide anywhere on the checkout page, not just this exact slot: its own
  // lock timer already covers that, and clicking "Resume" while already
  // there just re-navigated to the current URL — a no-op that looked like a
  // broken button. Comparing the full slotId+venue+date match was too easy
  // to get wrong (e.g. before the query params finish updating); the route
  // alone is the reliable signal.
  if (location.pathname === paths.player.checkout) return null;

  void now; // triggers the 1s re-render for the countdown below

  const handleCancel = async () => {
    if (!hold?.slotId || cancelling) return;
    setCancelling(true);
    try {
      await releaseHold(hold.slotId);
    } catch {
      // Best-effort release
    } finally {
      clearHold(hold.slotId);
      setHold(null);
      setCancelling(false);
    }
  };

  return (
    <div className="held-slot-banner" role="status">
      <span className="held-slot-banner-icon" aria-hidden="true">⏳</span>
      <div className="held-slot-banner-text">
        <b>Booking in progress</b>
        <span>
          {hold.pitchName ?? 'A slot'} is on hold &middot; {formatCountdown(secondsLeft)} left
        </span>
      </div>
      <div className="held-slot-banner-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm held-slot-banner-cta"
          onClick={() => navigate(checkoutHref)}
        >
          Resume
        </button>
        <button
          type="button"
          className="btn btn-tertiary btn-sm held-slot-banner-cancel"
          onClick={handleCancel}
          disabled={cancelling}
          title="Cancel booking hold"
          aria-label="Cancel booking process"
        >
          {cancelling ? '…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
