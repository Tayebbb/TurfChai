import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Photo } from '@/components/ui/Photo';
import { createBooking, formatTimeRange, getVenueSlots, holdSlot } from '@/api/bookings';
import { getVenue } from '@/api/venues';
import { useApi } from '@/hooks/useApi';
import { useCountdown } from '@/hooks/useCountdown';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';
import './CheckoutPage.css';

/**
 * Confirming a slot is the only money-shaped action the backend supports:
 * `POST /bookings` records the slot's own price and nothing is charged
 * online. There is no gateway, no deposit and no split payment, so this
 * screen shows one price, one button, and says so plainly.
 */

const POLICY = [
  {
    id: 'cancel',
    tone: 'ok',
    strokeWidth: '2.5',
    icon: <polyline points="20 6 9 17 4 12" />,
    body: (
      <>
        Cancel any time before kick-off from <b>My bookings</b> — the slot goes straight back to
        other players.
      </>
    ),
  },
  {
    id: 'hold',
    tone: 'warn',
    strokeWidth: '2.5',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    body: 'Your slot is held for 5 minutes. When the hold expires it is released to everyone else.',
  },
  {
    id: 'no-charge',
    tone: '',
    strokeWidth: '2',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    body: 'No card or wallet is charged when you confirm — TurfChai does not process payments yet.',
  },
];

const secondsUntil = (heldUntil) =>
  Math.max(0, Math.round((new Date(heldUntil).getTime() - Date.now()) / 1000));

/** `"2026-08-08"` → `"Fri 8 Aug"` */
function formatSlotDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Minutes between two `"HH:mm:ss"` strings, or null when unparseable. */
function slotMinutes(startTime, endTime) {
  const toMinutes = (value) => {
    const [hours, minutes] = String(value ?? '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  };
  const from = toMinutes(startTime);
  const to = toMinutes(endTime);
  if (from == null || to == null) return null;
  return to > from ? to - from : to + 24 * 60 - from;
}

/**
 * There is no `GET /slots/{id}`, so the slot is resolved through its venue's
 * day list — which is why checkout carries `venue` and `date` next to
 * `slotId`.
 */
async function loadSlotContext(venueSlug, date, slotId) {
  const venue = await getVenue(venueSlug);
  const slots = await getVenueSlots(venue.id, date);
  const slot = (Array.isArray(slots) ? slots : []).find(
    (item) => String(item.id) === String(slotId),
  );
  return { venue, slot: slot ?? null };
}

export default function CheckoutPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get('slotId');
  const venueSlug = searchParams.get('venue');
  const date = searchParams.get('date');

  const [understood, setUnderstood] = useState(false);
  const [hold, setHold] = useState(() =>
    slotId ? { state: 'holding', heldUntil: null, message: '' } : { state: 'idle', heldUntil: null, message: '' },
  );
  const [lockSeconds, setLockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  const context = useApi(
    () =>
      slotId && venueSlug && date ? loadSlotContext(venueSlug, date, slotId) : Promise.resolve(null),
    [slotId, venueSlug, date],
  );
  const venue = context.data?.venue ?? null;
  const slot = context.data?.slot ?? null;
  const price = slot?.price != null ? Number(slot.price) : null;
  const backHref = venueSlug ? paths.player.venue(venueSlug) : paths.player.explore;

  const acquireHold = useCallback(async () => {
    try {
      const result = await holdSlot(slotId);
      setHold({ state: 'held', heldUntil: result.heldUntil, message: '' });
      setLockSeconds(secondsUntil(result.heldUntil));
      return true;
    } catch (error) {
      const taken = error.status === 409;
      setHold({
        state: 'error',
        heldUntil: null,
        message: taken
          ? 'This slot was just taken by someone else. Please choose another time.'
          : error.message || 'Could not lock this slot. Please try again.',
      });
      return false;
    }
  }, [slotId]);

  const rehold = async () => {
    setHold({ state: 'holding', heldUntil: null, message: '' });
    return acquireHold();
  };

  // Guards the one-shot hold-on-mount against firing twice for the same
  // slotId — React StrictMode double-invokes effects in dev, and without
  // this the second call would race the first hold-slot request (the
  // backend now tolerates a duplicate hold from the same user, but there's
  // no reason to send it twice).
  const holdRequestedForRef = useRef(null);
  useEffect(() => {
    if (slotId && holdRequestedForRef.current !== slotId) {
      holdRequestedForRef.current = slotId;
      acquireHold();
    }
  }, [slotId, acquireHold]);

  const { label: lockLabel } = useCountdown(lockSeconds, {
    onExpire:
      hold.state === 'held'
        ? () => setHold({ state: 'expired', heldUntil: null, message: 'Your 5-minute hold expired.' })
        : undefined,
  });

  const onConfirm = async () => {
    if (!slotId || busy || hold.state !== 'held') return;
    setBusy(true);
    try {
      const booking = await createBooking(slotId);
      navigate(`${paths.player.bookingSuccess}?bookingId=${booking.id}`);
    } catch (error) {
      if (error.status === 401) {
        showToast('Your session expired — sign in again to confirm this booking');
      } else if (error.status === 409) {
        showToast('Slot was taken while you were confirming — locking it again');
        const reheld = await rehold();
        if (!reheld) showToast('Slot is no longer available — please pick another time slot');
      } else {
        showToast(error.message || 'Booking could not be confirmed — try again');
      }
    } finally {
      setBusy(false);
    }
  };

  const lockText =
    hold.state === 'holding'
      ? 'Locking your slot…'
      : hold.state === 'held'
        ? lockLabel
        : hold.state === 'expired'
          ? 'Hold expired'
          : 'Slot unavailable';

  if (!slotId) {
    return (
      <>
        <PageTitle title="Checkout" />
        <main className="wrap" id="main" style={{ paddingTop: 60, maxWidth: 640, paddingBottom: 60 }}>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>No slot selected</h1>
          <p className="subtle">
            Pick a venue and time slot first, then come back here to confirm your booking.
          </p>
          <Link className="btn btn-primary" to={paths.player.explore}>
            Browse venues
          </Link>
        </main>
      </>
    );
  }

  const timeRange = slot ? formatTimeRange(slot.startTime, slot.endTime) : null;
  const minutes = slot ? slotMinutes(slot.startTime, slot.endTime) : null;
  const detailsUnavailable = !context.loading && !context.error && !slot;

  return (
    <>
      <PageTitle title="Checkout" />
      <main className="wrap" id="main" style={{ paddingTop: 28, maxWidth: 1000, paddingBottom: 60 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <Link className="btn btn-tertiary btn-sm" to={backHref} style={{ paddingLeft: 0 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {venueSlug ? 'Back to venue' : 'Back to Explore'}
          </Link>
          <div className="lock-timer" role="timer" aria-label="Slot locked, time remaining">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Slot locked &middot; <span>{lockText}</span>
          </div>
        </div>

        {hold.state === 'error' || hold.state === 'expired' ? (
          <div className="alert warn" role="status" style={{ marginBottom: 20 }}>
            <span className="ico">⚠️</span>
            <div>
              <b>{hold.state === 'expired' ? 'Hold expired' : 'Slot unavailable'}</b>
              {hold.message}
              <Button
                size="sm"
                variant="secondary"
                style={{ marginLeft: 10 }}
                onClick={rehold}
                disabled={hold.state === 'holding'}
              >
                Re-lock slot
              </Button>
            </div>
          </div>
        ) : null}

        <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>Confirm your slot</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
          Your slot is held for 5 minutes — no one else can take it while you check the details.
        </p>

        <div className="co-grid">
          <div>
            {/* Step 1: What confirming actually does */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  1
                </div>
                <div className="co-step-title">Payment</div>
              </div>
              <div className="policy-box">
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-2)' }}>
                  TurfChai does not take online payments yet. Confirming reserves the slot in your
                  name and records the amount below —{' '}
                  <b>nothing is charged to a card, bKash or Nagad account</b>. Settle the amount
                  with the venue.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                  Paying a deposit and splitting the bill with your team are not available yet.
                </p>
              </div>
            </div>

            {/* Step 2: Policy */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  2
                </div>
                <div className="co-step-title">Cancellation policy</div>
              </div>

              <div className="policy-box">
                <ul className="policy-list">
                  {POLICY.map((rule) => (
                    <li className={rule.tone || undefined} key={rule.id}>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={rule.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {rule.icon}
                      </svg>
                      {rule.body}
                    </li>
                  ))}
                </ul>
              </div>

              <label className="checkline" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                />
                <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                  I understand the cancellation policy
                  {timeRange ? (
                    <>
                      {' '}
                      and that my slot is <b>{timeRange}</b> on {formatSlotDate(slot.slotDate)}
                    </>
                  ) : null}
                  .
                </span>
              </label>
            </div>
          </div>

          {/* Order summary */}
          <aside className="co-summary">
            {context.loading ? (
              <p className="subtle" role="status" style={{ margin: '4px 0 16px' }}>
                Loading slot details…
              </p>
            ) : null}

            {context.error ? (
              <div className="alert warn" role="status" style={{ marginBottom: 14 }}>
                <span className="ico">⚠️</span>
                <div>
                  <b>Could not load the slot details</b>
                  {context.error.status === 401
                    ? 'Sign in to continue.'
                    : context.error.message}
                  {context.error.status === 401 ? (
                    <Button size="sm" variant="secondary" style={{ marginLeft: 10 }} to={paths.auth}>
                      Sign in
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      style={{ marginLeft: 10 }}
                      onClick={context.reload}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            {detailsUnavailable ? (
              <p className="subtle" role="status" style={{ margin: '4px 0 16px' }}>
                Slot details are not available from this link. You can still confirm the slot you
                picked — check the time and price on the venue page first.
              </p>
            ) : null}

            {slot ? (
              <>
                <div className="co-venue-row">
                  <div className="co-venue-thumb">
                    <Photo />
                  </div>
                  <div>
                    <div className="co-venue-name">{venue?.name ?? 'Venue'}</div>
                    <div className="co-venue-sub">
                      {[slot.pitchName, venue?.area].filter(Boolean).join(' \u00b7 ')}
                    </div>
                  </div>
                </div>

                <div className="co-detail">
                  <div className="co-detail-row">
                    <span className="co-detail-label">Date</span>
                    <span className="co-detail-value">{formatSlotDate(slot.slotDate)}</span>
                  </div>
                  <div className="co-detail-row">
                    <span className="co-detail-label">Play time</span>
                    <span className="co-detail-value num">{timeRange}</span>
                  </div>
                  {venue?.address ? (
                    <div className="co-detail-row">
                      <span className="co-detail-label">Address</span>
                      <span className="co-detail-value">{venue.address}</span>
                    </div>
                  ) : null}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div className="pricerow">
                    <span className="pr-label">Slot{minutes ? ` (${minutes} min)` : ''}</span>
                    <span className="pr-val num">{formatBdt(price)}</span>
                  </div>
                </div>

                <div className="pricerow total">
                  <span className="pr-label">Total</span>
                  <span className="pr-val num">{formatBdt(price)}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 16px' }}>
                  Recorded against your booking — not charged online.
                </p>
              </>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              block
              id="pay-cta"
              onClick={onConfirm}
              loading={busy}
              disabled={hold.state !== 'held' || !understood}
            >
              {price != null ? `Confirm booking \u00b7 ${formatBdt(price)}` : 'Confirm booking'}
            </Button>
            {hold.state === 'held' && !understood ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
                Tick the cancellation policy box to continue.
              </p>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}
