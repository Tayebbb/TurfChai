import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Photo } from '@/components/ui/Photo';
import { getVenueSlots, holdSlot, listBookings, releaseHold } from '@/api/bookings';
import { getToken } from '@/api/client';
import { getVenue } from '@/api/venues';
import { checkout, getAvailablePromoCodes, validatePromoCode } from '@/api/payments';
import { getMyPoints } from '@/api/rewards';
import { useApi } from '@/hooks/useApi';
import { useCountdown } from '@/hooks/useCountdown';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { Field, Input, Select } from '@/components/forms/Field';
import { SKILL_LABELS } from '@/api/openGames';
import { paths } from '@/routes/paths';
import './CheckoutPage.css';

const CARD_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

// Ids match the backend's PaymentMethod enum (BKASH/NAGAD/CARD) exactly —
// "Bank transfer" was dropped, it isn't one of the methods payments.method
// actually supports.
const METHODS = [
  { id: 'BKASH', domId: 'pay-bkash', label: 'bKash', logo: 'bK', color: '#D12053' },
  { id: 'NAGAD', domId: 'pay-nagad', label: 'Nagad', logo: 'N', color: '#F26522' },
  { id: 'CARD', domId: 'pay-card', label: 'Card', logo: CARD_ICON, color: '#2660D8' },
];

const METHOD_HINTS = {
  BKASH: 'Pay the venue by bKash. TurfChai never asks for your PIN.',
  NAGAD: 'Pay the venue by Nagad. TurfChai never asks for your PIN.',
  CARD: 'Pay the venue by card on arrival. TurfChai never asks for your card number.',
};

// Provider brand tones for the confirmation panel, kept separate from the
// method-selector colours above.
const BRAND_COLORS = {
  BKASH: '#E2136E',
  NAGAD: '#F26522',
  CARD: '#2660D8',
};

// ponytail: policy tiers derived from the venue's real cancelPolicy, same
// logic VenuePage uses. Ceiling: fetch policy through the slot payload so
// checkout never needs the extra venue fetch.
const policyTiersOf = (cancelPolicy) => {
  const icons = {
    ok: <polyline points="20 6 9 17 4 12" />,
    warn: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    no: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
  };
  const window = {
    ok: <polyline points="20 6 9 17 4 12" />,
    warn: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  };
  const tier = (id, tone, strokeWidth, body) => ({
    id,
    tone,
    strokeWidth,
    icon: icons[tone] ?? icons.ok,
    body,
  });
  if (cancelPolicy === 'FLEXIBLE_6H') {
    return [
      tier('free', 'ok', '2.5', 'Free cancellation any time more than 6h before your slot'),
      tier('none', 'no', '2.5', 'No refund within 6h of your slot'),
    ];
  }
  if (cancelPolicy === 'STRICT_NO_REFUND') {
    return [tier('none', 'no', '2.5', 'No refund for cancellations — this venue has a strict policy')];
  }
  // FREE_24H_50_6H (default) and anything unknown.
  return [
    tier('free', 'ok', '2.5', 'Free cancellation 24h or more before your slot'),
    tier('half', 'warn', '2.5', '50% refund 6–24h before your slot'),
    tier('none', 'no', '2.5', 'No refund within 6h of your slot'),
  ];
};

const REFUND_CHANNEL_NOTE = {
  id: 'channel',
  tone: '',
  strokeWidth: '2',
  body: 'Refunds are returned by the venue through your original payment channel',
  icon: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
};

const secondsUntil = (heldUntil) =>
  Math.max(0, Math.round((new Date(heldUntil).getTime() - Date.now()) / 1000));

// sessionStorage helpers — keyed by slotId so switching slots never bleeds.
const HOLD_KEY = (slotId) => `slot_hold_${slotId}`;
const saveHold  = (slotId, heldUntil) => sessionStorage.setItem(HOLD_KEY(slotId), heldUntil);
const loadHold  = (slotId) => sessionStorage.getItem(HOLD_KEY(slotId));
const clearHold = (slotId) => sessionStorage.removeItem(HOLD_KEY(slotId));

const bdt = (value) =>
  value == null ? '—' : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

/** '18:00:00' -> '6:00 PM' */
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function CheckoutPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get('slotId');

  // Browsing checkout is open to everyone; holding and confirming a slot are
  // the only actions that need an identity.
  const signedIn = Boolean(getToken());
  const signInHref = `${paths.auth}?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  const [method, setMethod] = useState('BKASH');
  // Deliberately NOT pre-checked: agreeing to terms the user never read is
  // a dark pattern, and the venue's policy can be strict.
  const [understood, setUnderstood] = useState(false);
  const [applyWallet, setApplyWallet] = useState(false);
  // On mount, check sessionStorage for a still-valid hold so a page refresh
  // doesn't reset the 5-minute window by calling holdSlot a second time.
  //
  // A *cached-but-expired* entry means this browser already held this slot
  // and the hold ran out — that must land on 'expired' (manual "Re-lock
  // slot" only), not fall through to the same bucket as a slot never held
  // in this session. Treating them the same was the bug: refreshing after
  // expiry looked exactly like a first visit, so the mount effect below
  // auto-called holdSlot() again and silently restarted a fresh 5-minute
  // timer with no click from the player at all.
  const [hold, setHold] = useState(() => {
    if (!slotId) return { state: 'idle', heldUntil: null, message: '' };
    const cached = loadHold(slotId);
    if (cached) {
      return secondsUntil(cached) > 0
        ? { state: 'held', heldUntil: cached, message: '' }
        : { state: 'expired', heldUntil: null, message: 'Your 5-minute hold expired.' };
    }
    return { state: 'holding', heldUntil: null, message: '' };
  });
  const [slotInfo, setSlotInfo] = useState(null);
  const [venueInfo, setVenueInfo] = useState(null);
  const [lockSeconds, setLockSeconds] = useState(() => {
    if (!slotId) return 0;
    const cached = loadHold(slotId);
    return cached ? secondsUntil(cached) : 0;
  });
  const [busy, setBusy] = useState(false);
  // `applied` is the server's quote for the typed code; `error` is its reason
  // for refusing one. Nothing here is trusted at payment time.
  const [promo, setPromo] = useState({ input: '', applied: null, error: '', checking: false });
  const [promoListOpen, setPromoListOpen] = useState(false);

  // Confirmation overlay state. No payment credentials are collected.
  const [gatewayStep, setGatewayStep] = useState(null); // null | 'confirm' | 'processing'
  const [gatewayError, setGatewayError] = useState(null);

  const [bookingMode, setBookingMode] = useState('FULL'); // 'FULL' | 'SPLIT' | 'OPEN_GAME'
  const [splitPlayers, setSplitPlayers] = useState('5');
  const [openGameForm, setOpenGameForm] = useState({
    title: '',
    capacity: '10',
    reservedSpots: '4',
    pricePerPlayer: '',
    skillLevel: 'ALL_LEVELS',
  });

  const wallet = useApi(() => (signedIn ? getMyPoints() : Promise.resolve(null)), [signedIn]);
  const walletBalance = wallet.data?.walletBalance ?? 0;
  const slotPrice = slotInfo?.price ?? null;
  const venueIdForPromos = slotInfo?.venueId ?? null;
  const availablePromos = useApi(
    () => (venueIdForPromos ? getAvailablePromoCodes(venueIdForPromos) : Promise.resolve([])),
    [venueIdForPromos],
  );
  const promoOptions = Array.isArray(availablePromos.data) ? availablePromos.data : [];
  // The server prices the discount again at checkout; this is only the quote the
  // player is shown, so a tampered value cannot buy a cheaper booking.
  const discount = promo.applied ? Math.min(promo.applied.discountAmount, slotPrice ?? 0) : 0;
  const fullPayable = slotPrice != null ? Math.max(0, slotPrice - discount) : null;

  // Split calculation
  const splitCount = Math.max(2, Math.min(20, Number(splitPlayers) || 2));
  const splitSharePerPlayer = fullPayable != null ? Math.round(fullPayable / splitCount) : null;
  const splitHostDue = splitSharePerPlayer;

  // Open Game calculation
  const ogCapacity = Math.max(2, Math.min(20, Number(openGameForm.capacity) || 10));
  const ogReserved = Math.max(1, Math.min(ogCapacity - 1, Number(openGameForm.reservedSpots) || 1));
  const ogOpenSpots = Math.max(1, ogCapacity - ogReserved);
  const ogPricePerPlayer = fullPayable != null ? Math.max(0, Math.round(fullPayable / ogCapacity)) : null;
  const ogHostDue = ogPricePerPlayer;

  // Target amount due from host now based on active booking mode
  const hostTotalDue = bookingMode === 'SPLIT'
    ? splitHostDue
    : bookingMode === 'OPEN_GAME'
      ? ogHostDue
      : fullPayable;

  const walletApplied = applyWallet && hostTotalDue != null ? Math.min(walletBalance, hostTotalDue) : 0;
  const dueNow = hostTotalDue != null ? Math.max(0, hostTotalDue - walletApplied) : null;

  const acquireHold = useCallback(async () => {
    try {
      const result = await holdSlot(slotId);
      saveHold(slotId, result.heldUntil);
      setHold({ state: 'held', heldUntil: result.heldUntil, message: '' });
      setLockSeconds(secondsUntil(result.heldUntil));
      setSlotInfo({
        price: result.price,
        venueId: result.venueId,
        pitchId: result.pitchId,
        pitchName: result.pitchName,
        slotDate: result.slotDate,
        startTime: result.startTime,
        endTime: result.endTime,
      });
      return true;
    } catch (error) {
      clearHold(slotId);
      const taken = error.status === 409;
      // The server allows only one active hold per player. Landing here with
      // this specific reason means the player already has a *different* slot
      // held elsewhere — the fix is to send them back to it, not to imply
      // this slot itself is unavailable.
      if (taken && /already have a slot on hold/i.test(error.detail || '')) {
        setHold({
          state: 'blocked-elsewhere',
          heldUntil: null,
          message: 'You already have another slot on hold. Finish or release it before starting a new booking.',
        });
        return false;
      }
      // The slot's own kick-off time has passed — not "someone else took it"
      // (nobody did), and re-locking is never going to succeed no matter how
      // many times it's retried. This used to fall into the generic 409
      // branch below, which kept the "Re-lock slot" button live: clicking it
      // just flashed "Locking your slot…" and failed the same way again,
      // reading as a broken, endlessly restarting timer.
      if (taken && /already started/i.test(error.detail || '')) {
        setHold({
          state: 'slot-started',
          heldUntil: null,
          message: 'This slot’s start time has passed, so it can no longer be booked.',
        });
        return false;
      }
      if (taken) {
        // The commonest way to land here is the back button after paying: the
        // slot is unavailable because this very user booked it. Saying
        // "someone else took it" made a successful booking look like a failure.
        try {
          const mine = await listBookings();
          const own = (Array.isArray(mine) ? mine : []).find(
            (b) => String(b.slotId) === String(slotId) && b.status !== 'CANCELLED',
          );
          if (own) {
            setHold({ state: 'mine', heldUntil: null, message: '', bookingId: own.id });
            return false;
          }
        } catch {
          // Fall through to the generic message below.
        }
      }
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
    if (signedIn && slotId && holdRequestedForRef.current !== slotId) {
      holdRequestedForRef.current = slotId;
      // Skip the network call entirely when sessionStorage already has an
      // opinion about this slot: a still-valid cached hold needs no re-fetch
      // (the user refreshed mid-checkout), and an *expired* one must not
      // silently re-acquire — that reopens the "refresh restarts the timer
      // with no click" bug. Only a slot never touched in this session (no
      // cache entry at all) should auto-hold on arrival.
      if (loadHold(slotId) != null) return;
      acquireHold();
    }
  }, [signedIn, slotId, acquireHold]);

  // Slot details used to arrive only with the hold, which needs a session and
  // fails once the slot is yours, so the summary blanked to "—". The venue and
  // its slots are public, so read them directly whatever the hold does.
  const venueSlug = searchParams.get('venue');
  const slotDate = searchParams.get('date');
  useEffect(() => {
    if (!slotId || !venueSlug || !slotDate) return;
    let cancelled = false;
    getVenue(venueSlug)
      .then((venue) => {
        if (cancelled) return;
        // The venue's real policy + identity must show at checkout; the
        // summary previously had no venue name and the policy was hardcoded.
        setVenueInfo({
          id: venue.id,
          name: venue.name,
          photos: Array.isArray(venue.photos) ? venue.photos : [],
          cancelPolicy: venue.cancelPolicy,
        });
        return getVenueSlots(venue.id, slotDate);
      })
      .then((slots) => {
        if (cancelled) return;
        const match = (Array.isArray(slots) ? slots : []).find((s) => String(s.id) === String(slotId));
        if (match) {
          setSlotInfo((current) => current ?? {
            price: match.price,
            venueId: match.venueId,
            pitchId: match.pitchId,
            pitchName: match.pitchName,
            slotDate: match.slotDate,
            startTime: match.startTime,
            endTime: match.endTime,
          });
        }
      })
      .catch(() => {
        // Preview only; the call to action is unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, [slotId, venueSlug, slotDate]);

  const { label: lockLabel } = useCountdown(lockSeconds, {
    onExpire:
      hold.state === 'held'
        ? () => {
            // Deliberately NOT clearing sessionStorage here. The stale,
            // now-expired entry is what tells a page refresh "this browser
            // already held this slot and it ran out" — wiping it made a
            // refresh look identical to a first visit, so the mount effect
            // auto-called holdSlot() again and silently handed back a fresh
            // 5-minute timer with no click from the player.
            setHold({ state: 'expired', heldUntil: null, message: 'Your 5-minute hold expired.' });
          }
        : undefined,
  });

  const onPay = () => {
    if (!signedIn) {
      navigate(signInHref);
      return;
    }
    if (!slotId || busy || hold.state !== 'held') return;
    setGatewayError(null);
    setGatewayStep('confirm');
  };

  const [cancelling, setCancelling] = useState(false);

  const handleCancelProcess = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      if (signedIn && slotId) {
        await releaseHold(slotId);
      }
    } catch {
      // Best-effort release
    } finally {
      clearHold(slotId);
      showToast('Booking process cancelled');
      setCancelling(false);
      const returnUrl = venueSlug ? paths.player.venue(venueSlug) : paths.player.explore;
      navigate(returnUrl);
    }
  };

  const closeGateway = () => {
    setGatewayStep(null);
  };

  const applyPromo = async (codeOverride) => {
    const code = (codeOverride ?? promo.input).trim();
    if (!code || slotPrice == null) return;
    setPromoListOpen(false);
    setPromo((prev) => ({ ...prev, input: code, checking: true, error: '' }));
    try {
      const quote = await validatePromoCode({
        code,
        orderTotal: slotPrice,
        venueId: slotInfo?.venueId,
      });
      if (quote?.valid) {
        setPromo({ input: '', applied: quote, error: '', checking: false });
        showToast(`${quote.code} applied — ${bdt(quote.discountAmount)} off`);
      } else {
        setPromo((prev) => ({
          ...prev,
          checking: false,
          error: quote?.message || 'That promo code cannot be used for this booking',
        }));
      }
    } catch (error) {
      // A refused code answers 422 with the reason in the body.
      setPromo((prev) => ({
        ...prev,
        checking: false,
        error: error.detail || error.message || 'That promo code cannot be used for this booking',
      }));
    }
  };

  const removePromo = () => setPromo({ input: '', applied: null, error: '', checking: false });

  const confirmPayment = async () => {
    setGatewayStep('processing');
    setBusy(true);
    try {
      const result = await checkout({
        slotId,
        method,
        applyWalletAmount: walletApplied > 0 ? walletApplied : undefined,
        promoCode: promo.applied?.code,
        bookingMode,
        splitPlayerCount: bookingMode === 'SPLIT' ? splitCount : undefined,
        openGameTitle: bookingMode === 'OPEN_GAME' ? (openGameForm.title?.trim() || `${slotInfo?.pitchName || 'Turf'} Match`) : undefined,
        openGameCapacity: bookingMode === 'OPEN_GAME' ? ogCapacity : undefined,
        openGameReservedSpots: bookingMode === 'OPEN_GAME' ? ogReserved : undefined,
        openGamePricePerPlayer: bookingMode === 'OPEN_GAME' ? ogPricePerPlayer : undefined,
        openGameSkillLevel: bookingMode === 'OPEN_GAME' ? openGameForm.skillLevel : undefined,
      });
      if (result.status === 'SUCCESS') {
        if (bookingMode === 'SPLIT' || bookingMode === 'OPEN_GAME') {
          showToast('Booking confirmed & your share is paid! Share the QR or link with your squad 🎉');
          navigate(paths.player.bookingDetail(result.bookingId));
        } else {
          navigate(`${paths.player.bookingSuccess}?bookingId=${encodeURIComponent(result.bookingId)}`, {
            state: { pointsEarned: result.pointsEarned },
          });
        }
      } else {
        setGatewayStep('confirm');
        setGatewayError(result.message || 'Payment could not be completed — try again');
      }
    } catch (error) {
      setGatewayStep(null);
      if (error.status === 409) {
        showToast('Slot was taken while you were paying — locking it again');
        const reheld = await rehold();
        if (!reheld) showToast('Slot is no longer available — please pick another time slot');
      } else if (error.status === 422) {
        // The code was still valid when quoted but not when the payment ran —
        // it expired, was paused, or somebody took the last use. Drop it so the
        // player can pay the real price rather than being stuck.
        const reason = error.detail || 'That promo code is no longer valid';
        setPromo({ input: '', applied: null, error: reason, checking: false });
        showToast(`${reason} — the discount has been removed`);
      } else {
        showToast(toUserMessage(error, 'Payment could not be completed — try again'));
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Confirmation and progress only. TurfChai has no payment provider, so it
   * must not ask for a card number, a CVV or a wallet PIN — collecting
   * credentials it cannot use, and does not send anywhere, would be worse than
   * useless. The method the player picks is real: it is stored on the payment
   * record and the venue settles against it.
   */
  const renderGateway = () => {
    const brand = BRAND_COLORS[method] ?? BRAND_COLORS.CARD;
    const meta = METHODS.find((item) => item.id === method);

    return (
      <section className="gw" aria-live="polite">
        <div className="gw-head" style={{ background: brand }}>
          <span className="gw-logo" aria-hidden="true">
            {meta.logo}
          </span>
          <div className="gw-head-mid">
            <b>{methodLabel}</b>
            <span>Confirm your booking</span>
          </div>
          <div className="gw-amount">
            <span>AMOUNT</span>
            <b className="num">{bdt(dueNow)}</b>
          </div>
        </div>

        {gatewayStep === 'confirm' ? (
          <div className="gw-body">
            <button type="button" className="gw-cancel" onClick={closeGateway}>
              ← Back
            </button>
            <h2 className="gw-title">Confirm this booking</h2>

            <div className="alert info" style={{ marginTop: 4 }}>
              <span className="ico" aria-hidden="true">ℹ️</span>
              <div className="small">
                TurfChai does not take payment online yet. Confirming reserves the slot in your
                name and records <b>{bdt(dueNow)}</b> as due by {methodLabel} — you pay the venue
                directly. Never enter a card number or wallet PIN here.
              </div>
            </div>

            <div className="gw-receipt" style={{ marginTop: 12 }}>
              <div className="co-detail-row">
                <span className="co-detail-label">Method</span>
                <span className="co-detail-value">{methodLabel}</span>
              </div>
              <div className="co-detail-row">
                <span className="co-detail-label">Amount due</span>
                <span className="co-detail-value num">{bdt(dueNow)}</span>
              </div>
            </div>

            {gatewayError ? (
              <div className="alert warn" role="status" style={{ marginTop: 8 }}>
                <span className="ico">⚠️</span>
                <div>{gatewayError}</div>
              </div>
            ) : null}

            <div className="gw-foot">
              <Button variant="primary" size="lg" block onClick={confirmPayment} disabled={busy}>
                {busy ? 'Confirming…' : `Confirm & reserve · ${bdt(dueNow)}`}
              </Button>
            </div>
          </div>
        ) : null}

        {gatewayStep === 'processing' ? (
          <div className="gw-body gw-center">
            <div className="gw-spinner" role="status" aria-label="Confirming booking" />
            <h2 className="gw-title">Confirming your booking…</h2>
            <p className="subtle" style={{ margin: 0 }}>
              Please don&apos;t close this window.
            </p>
          </div>
        ) : null}
      </section>
    );
  };

  const lockText = !signedIn
    ? 'Sign in to hold this slot'
    : hold.state === 'holding'
      ? 'Locking your slot…'
      : hold.state === 'held'
        ? lockLabel
        : hold.state === 'mine'
          ? 'Already booked by you'
          : hold.state === 'expired'
            ? 'Hold expired'
            : hold.state === 'blocked-elsewhere'
              ? 'Another slot is on hold'
              : hold.state === 'slot-started'
                ? 'Slot start time passed'
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

  const slotTimeLabel =
    slotInfo?.startTime && slotInfo?.endTime
      ? `${formatTime(slotInfo.startTime)} – ${formatTime(slotInfo.endTime)}`
      : '—';
  const methodLabel = METHODS.find((item) => item.id === method)?.label ?? method;

  return (
    <>
      <PageTitle title="Checkout" />
      <main className="wrap" id="main" style={{ paddingTop: 28, maxWidth: 1000, paddingBottom: 60 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <Link
            className="btn btn-tertiary btn-sm"
            to={venueSlug ? paths.player.venue(venueSlug) : paths.player.explore}
            style={{ paddingLeft: 0 }}
          >
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
            Back to {venueSlug ? 'venue' : 'venues'}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hold.state === 'held' ? (
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
            ) : null}
          </div>
        </div>

        {hold.state === 'mine' ? (
          <div className="alert ok" role="status" style={{ marginBottom: 20 }}>
            <span className="ico">✓</span>
            <div>
              <b>You have already booked this slot</b>
              It is reserved in your name — there is nothing left to pay here.
              <Link
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 10 }}
                to={paths.player.bookingDetail(hold.bookingId)}
              >
                View booking
              </Link>
            </div>
          </div>
        ) : null}

        {hold.state === 'blocked-elsewhere' ? (
          <div className="alert warn" role="status" style={{ marginBottom: 20 }}>
            <span className="ico">⚠️</span>
            <div>
              <b>Another slot is on hold</b>
              {hold.message} Look for the "Booking in progress" banner at the top of the app to jump
              back to it, or wait for that hold to expire.
            </div>
          </div>
        ) : null}

        {hold.state === 'slot-started' ? (
          <div className="alert warn" role="status" style={{ marginBottom: 20 }}>
            <span className="ico">⚠️</span>
            <div>
              <b>Slot start time passed</b>
              {hold.message} It cannot be re-locked — pick another time instead.
              <Link
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 10 }}
                to={paths.player.explore}
              >
                Browse venues
              </Link>
            </div>
          </div>
        ) : null}

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

        {gatewayStep ? (
          renderGateway()
        ) : (
          <>
            <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>Confirm your booking</h1>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
              {hold.state === 'held'
                ? 'Your slot is held for 5 minutes — no one else can take it while you confirm.'
                : 'Pick how to split the cost, confirm, and pay the venue directly.'}
            </p>

            <div className="co-grid">
          <div>
            {/* Step 1: Booking & Split Mode */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">1</div>
                <div className="co-step-title">How do you want to organize this booking?</div>
              </div>

              <div className="booking-mode-grid">
                <button
                  type="button"
                  className={`booking-mode-card ${bookingMode === 'FULL' ? 'selected' : ''}`}
                  onClick={() => setBookingMode('FULL')}
                >
                  <span className="booking-mode-icon" aria-hidden="true">🟢</span>
                  <div className="booking-mode-title">
                    <span>Pay in full</span>
                    {bookingMode === 'FULL' && <span className="badge green nodot sel-badge">Selected</span>}
                  </div>
                  <span className="booking-mode-desc">
                    Pay 100% upfront now as solo host.
                  </span>
                </button>

                <button
                  type="button"
                  className={`booking-mode-card ${bookingMode === 'SPLIT' ? 'selected' : ''}`}
                  onClick={() => setBookingMode('SPLIT')}
                >
                  <span className="booking-mode-icon" aria-hidden="true">👥</span>
                  <div className="booking-mode-title">
                    <span>Split with friends</span>
                    {bookingMode === 'SPLIT' && <span className="badge green nodot sel-badge">Selected</span>}
                  </div>
                  <span className="booking-mode-desc">
                    Pay your 1 share now; squad pays via link/QR.
                  </span>
                </button>

                <button
                  type="button"
                  className={`booking-mode-card ${bookingMode === 'OPEN_GAME' ? 'selected' : ''}`}
                  onClick={() => setBookingMode('OPEN_GAME')}
                >
                  <span className="booking-mode-icon" aria-hidden="true">📢</span>
                  <div className="booking-mode-title">
                    <span>Split &amp; Post Game</span>
                    {bookingMode === 'OPEN_GAME' && <span className="badge green nodot sel-badge">Selected</span>}
                  </div>
                  <span className="booking-mode-desc">
                    Reserve spots for friends &amp; open rest to public.
                  </span>
                </button>
              </div>

              {bookingMode === 'SPLIT' && (
                <div className="booking-mode-config-box">
                  <Field label="Total number of players to split with" htmlFor="co-split-players">
                    <Input
                      id="co-split-players"
                      type="number"
                      min="2"
                      max="20"
                      value={splitPlayers}
                      onChange={(e) => setSplitPlayers(e.target.value)}
                    />
                  </Field>

                  <div className="booking-mode-calc-badge" style={{ marginTop: 12 }}>
                    <span>
                      <b>{bdt(splitSharePerPlayer)}</b> per person ({splitCount} players)
                    </span>
                    <span style={{ color: 'var(--brand)', fontWeight: 700 }}>
                      Your share due now: {bdt(splitHostDue)}
                    </span>
                  </div>
                  <p className="subtle tiny" style={{ margin: '8px 0 0' }}>
                    After paying your share ({bdt(splitHostDue)}), you will get the QR code &amp; payment link to share with the other {splitCount - 1} players.
                  </p>
                </div>
              )}

              {bookingMode === 'OPEN_GAME' && (
                <div className="booking-mode-config-box">
                  <Field label="Game title" htmlFor="co-og-title">
                    <Input
                      id="co-og-title"
                      placeholder="e.g. Friday night 7-a-side friendly"
                      value={openGameForm.title}
                      onChange={(e) => setOpenGameForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <Field
                      label="Total match capacity (Players)"
                      htmlFor="co-og-capacity"
                    >
                      <Input
                        id="co-og-capacity"
                        type="number"
                        min="2"
                        max="20"
                        value={openGameForm.capacity}
                        onChange={(e) => setOpenGameForm((prev) => ({ ...prev, capacity: e.target.value }))}
                      />
                    </Field>
                    <Field
                      label="Spots for your squad (You + Friends)"
                      htmlFor="co-og-reserved"
                    >
                      <Input
                        id="co-og-reserved"
                        type="number"
                        min="1"
                        max={ogCapacity - 1}
                        value={openGameForm.reservedSpots}
                        onChange={(e) => setOpenGameForm((prev) => ({ ...prev, reservedSpots: e.target.value }))}
                      />
                    </Field>
                  </div>

                  {/* Visual Allocation Bar & Clear Spot Breakdown */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600 }}>
                      <span style={{ color: 'var(--brand)' }}>👥 Your Squad: {ogReserved} spots</span>
                      <span style={{ color: 'var(--info)' }}>📢 Public Open Game: {ogOpenSpots} spots</span>
                    </div>

                    <div className="spot-allocation-bar" aria-hidden="true">
                      <div className="spot-bar-group" style={{ width: `${(ogReserved / ogCapacity) * 100}%` }} />
                      <div className="spot-bar-public" style={{ width: `${(ogOpenSpots / ogCapacity) * 100}%` }} />
                    </div>

                    <div className="spot-summary-grid">
                      <div className="spot-summary-card group">
                        <b style={{ display: 'block', color: 'var(--brand)', marginBottom: 4 }}>
                          👥 Your Squad ({ogReserved} spots)
                        </b>
                        <div className="subtle small" style={{ fontSize: 12, lineHeight: 1.45 }}>
                          • <b>You (Host)</b>: 1 spot (paying now)<br />
                          • <b>{ogReserved - 1} friend{ogReserved - 1 === 1 ? '' : 's'}</b>: will pay via link/QR
                        </div>
                      </div>

                      <div className="spot-summary-card public">
                        <b style={{ display: 'block', color: 'var(--info)', marginBottom: 4 }}>
                          📢 Public Open Game ({ogOpenSpots} spots)
                        </b>
                        <div className="subtle small" style={{ fontSize: 12, lineHeight: 1.45 }}>
                          • <b>{ogOpenSpots} open spots</b> will be posted on Open Games for anyone to join
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--surface-2, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="subtle tiny" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Price per player spot
                      </span>
                      <b style={{ fontSize: 15, color: 'var(--text)', marginTop: 2 }}>
                        {bdt(ogPricePerPlayer)} <span className="subtle small" style={{ fontSize: 12, fontWeight: 400 }}>({bdt(fullPayable)} ÷ {ogCapacity} spots)</span>
                      </b>
                    </div>

                    <Field label="Skill level" htmlFor="co-og-skill">
                      <Select
                        id="co-og-skill"
                        value={openGameForm.skillLevel}
                        onChange={(e) => setOpenGameForm((prev) => ({ ...prev, skillLevel: e.target.value }))}
                      >
                        {Object.entries(SKILL_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <b>Host share due now (1 spot):</b>
                    </span>
                    <b style={{ color: 'var(--brand)', fontSize: 15 }}>{bdt(ogHostDue)}</b>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Payment method */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  2
                </div>
                <div className="co-step-title">Payment method</div>
              </div>
              <div className="method-grid" role="radiogroup" aria-label="Payment method">
                {METHODS.map((item) => (
                  <label className="method" id={item.domId} key={item.id}>
                    <input
                      type="radio"
                      name="method"
                      checked={method === item.id}
                      onChange={() => setMethod(item.id)}
                    />
                    <span className="mlogo" style={{ background: item.color }}>
                      {item.logo}
                    </span>
                    {item.label}
                    <span className="badge green nodot sel-badge">Selected</span>
                  </label>
                ))}
              </div>
              <p className="method-hint">{METHOD_HINTS[method]}</p>
            </div>

            {/* Step 3: Policy */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  3
                </div>
                <div className="co-step-title">Cancellation policy</div>
              </div>

              <div className="policy-box">
                <ul className="policy-list">
                  {[...policyTiersOf(venueInfo?.cancelPolicy), REFUND_CHANNEL_NOTE].map((rule) => (
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
                  I understand the cancellation policy and the exact slot time{' '}
                  <b>
                    ({slotTimeLabel}
                    {slotInfo?.startTime ? ', arrive 10 min early' : ''})
                  </b>
                  .
                </span>
              </label>
            </div>
          </div>

          {/* Order summary */}
          <aside className="co-summary">
            <div className="co-venue-row">
              <div className="co-venue-thumb">
                <Photo photos={venueInfo?.photos} />
              </div>
              <div>
                <div className="co-venue-name">{venueInfo?.name ?? slotInfo?.pitchName ?? 'Your venue'}</div>
                <div className="co-venue-sub">
                  {slotInfo?.pitchName ? `${slotInfo.pitchName} · ` : ''}
                  {formatDate(slotInfo?.slotDate)} &middot; {slotTimeLabel}
                </div>
              </div>
            </div>

            <div className="co-detail">
              <div className="co-detail-row">
                <span className="co-detail-label">Date</span>
                <span className="co-detail-value">{formatDate(slotInfo?.slotDate) || '—'}</span>
              </div>
              <div className="co-detail-row">
                <span className="co-detail-label">Play time</span>
                <span className="co-detail-value num">{slotTimeLabel}</span>
              </div>
              <div className="co-detail-row">
                <span className="co-detail-label">Arrive by</span>
                <span className="co-detail-value">10 min early</span>
              </div>
            </div>

            {walletBalance > 0 ? (
              <label className="checkline" style={{ margin: '4px 0 12px' }}>
                <input
                  type="checkbox"
                  checked={applyWallet}
                  onChange={(event) => setApplyWallet(event.target.checked)}
                />
                <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                  Apply my wallet balance ({bdt(walletBalance)} available)
                </span>
              </label>
            ) : null}

            {signedIn && slotPrice != null ? (
              <div style={{ margin: '4px 0 12px' }}>
                {promo.applied ? (
                  <div className="between" style={{ gap: 8 }}>
                    <span className="small">
                      <b>{promo.applied.code}</b> applied
                      {promo.applied.label ? ` · ${promo.applied.label}` : ''}
                    </span>
                    <Button size="sm" variant="tertiary" onClick={removePromo}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        aria-label="Promo code"
                        placeholder="Promo code"
                        value={promo.input}
                        onChange={(event) =>
                          setPromo((prev) => ({ ...prev, input: event.target.value, error: '' }))
                        }
                        onFocus={() => setPromoListOpen(true)}
                        onBlur={() => setPromoListOpen(false)}
                        onKeyDown={(event) => event.key === 'Enter' && applyPromo()}
                        style={{ flex: 1, textTransform: 'capitalize' }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => applyPromo()}
                        loading={promo.checking}
                        disabled={promo.checking || !promo.input.trim()}
                        style={{ flexShrink: 0 }}
                      >
                        Apply
                      </Button>
                    </div>

                    {promoListOpen ? (
                      <div
                        className="promo-suggest"
                        role="listbox"
                        aria-label="Available promo codes"
                        // Keeps the input focused when a suggestion is clicked, so
                        // onBlur above doesn't close the list before the click lands.
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        {availablePromos.loading ? (
                          <div className="promo-suggest-empty">Loading codes…</div>
                        ) : promoOptions.length === 0 ? (
                          <div className="promo-suggest-empty">No promo codes available right now</div>
                        ) : (
                          promoOptions
                            .filter((item) =>
                              item.code.toLowerCase().includes(promo.input.trim().toLowerCase()),
                            )
                            .map((item) => (
                              <button
                                key={item.code}
                                type="button"
                                role="option"
                                className="promo-suggest-item"
                                onClick={() => applyPromo(item.code)}
                              >
                                <span className="promo-suggest-code">{item.code}</span>
                                <span className="promo-suggest-label">
                                  {item.label ||
                                    (item.discountType === 'PERCENT'
                                      ? `${item.discountValue}% off`
                                      : `${bdt(item.discountValue)} off`)}
                                </span>
                              </button>
                            ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                {promo.error ? (
                  <p className="tiny" role="alert" style={{ color: 'var(--danger)', margin: '6px 0 0' }}>
                    {promo.error}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div style={{ marginBottom: 8 }}>
              <div className="pricerow">
                <span className="pr-label">Total Slot Price</span>
                <span className="pr-val num">{bdt(slotPrice)}</span>
              </div>
              {discount > 0 ? (
                <div className="pricerow">
                  <span className="pr-label neg" style={{ color: 'var(--brand-600)' }}>
                    Promo {promo.applied?.code}
                  </span>
                  <span className="pr-val neg num">−{bdt(discount)}</span>
                </div>
              ) : null}
              {bookingMode === 'SPLIT' && (
                <div className="pricerow">
                  <span className="pr-label" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    Squad Split ({splitCount} players)
                  </span>
                  <span className="pr-val num" style={{ color: 'var(--brand)' }}>
                    {bdt(splitSharePerPlayer)} / player
                  </span>
                </div>
              )}
              {bookingMode === 'OPEN_GAME' && (
                <div className="pricerow">
                  <span className="pr-label" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    Open Game ({ogCapacity} spots, {ogOpenSpots} public)
                  </span>
                  <span className="pr-val num" style={{ color: 'var(--brand)' }}>
                    {bdt(ogPricePerPlayer)} / spot
                  </span>
                </div>
              )}
              {walletApplied > 0 ? (
                <div className="pricerow">
                  <span className="pr-label neg" style={{ color: 'var(--brand-600)' }}>
                    Wallet applied
                  </span>
                  <span className="pr-val neg num">−{bdt(walletApplied)}</span>
                </div>
              ) : null}
            </div>

            <div className="pricerow total">
              <span className="pr-label">
                {bookingMode !== 'FULL' ? 'Your Share Due Now' : 'Due now'}
              </span>
              <span className="pr-val num">{bdt(dueNow)}</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              block
              id="pay-cta"
              className="co-mobile-hide"
              onClick={onPay}
              loading={busy}
              aria-busy={busy}
              disabled={signedIn && (hold.state !== 'held' || !understood)}
              style={{ marginTop: 16 }}
            >
              {signedIn
                ? (bookingMode !== 'FULL'
                  ? `Confirm & pay ${bdt(dueNow)} (your share) at the venue`
                  : `Confirm booking · ${bdt(dueNow)} due at venue`)
                : 'Sign in to confirm this booking'}
            </Button>
            {signedIn && hold.state !== 'held' ? (
              <p className="tiny" role="status" style={{ color: 'var(--text-3)', margin: '8px 0 0', textAlign: 'center' }}>
                {hold.state === 'holding' ? 'Locking your slot…' : lockText}
              </p>
            ) : null}
            {signedIn && hold.state === 'held' && !understood ? (
              <p className="tiny" role="status" style={{ color: 'var(--text-3)', margin: '8px 0 0', textAlign: 'center' }}>
                Tick the policy confirmation above to continue.
              </p>
            ) : null}
            {signedIn ? (
              <Button
                variant="tertiary"
                size="md"
                block
                onClick={handleCancelProcess}
                disabled={busy || cancelling}
                style={{ marginTop: 8 }}
              >
                {cancelling ? 'Cancelling booking…' : 'Cancel & release this slot'}
              </Button>
            ) : null}
            {!signedIn ? (
              <p className="subtle small" style={{ margin: '8px 0 0', textAlign: 'center' }}>
                Browsing is open to everyone — we only need an account to hold the slot in your name.
              </p>
            ) : null}
          </aside>
          </div>

          {/* Phones: total + primary CTA pinned at the thumb zone; the
              summary column is below all three steps on small screens. */}
          <div className="co-mobile-bar" role="region" aria-label="Booking total and confirm">
            <div className="co-mobile-total">
              <span className="lbl">{bookingMode !== 'FULL' ? 'Your share' : 'Due now'}</span>
              <span className="val">{bdt(dueNow)}</span>
            </div>
            <Button
              variant="primary"
              onClick={onPay}
              loading={busy}
              aria-busy={busy}
              disabled={signedIn && (hold.state !== 'held' || !understood)}
            >
              {signedIn ? 'Confirm booking' : 'Sign in to confirm'}
            </Button>
          </div>
          </>
        )}
      </main>
    </>
  );
}
