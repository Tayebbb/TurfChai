import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Photo } from '@/components/ui/Photo';
import { holdSlot } from '@/api/bookings';
import { checkout } from '@/api/payments';
import { getMyPoints } from '@/api/rewards';
import { useApi } from '@/hooks/useApi';
import { useCountdown } from '@/hooks/useCountdown';
import { useToast } from '@/hooks/useToast';
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
  BKASH: "You'll approve the payment in your bKash app. TurfChai never sees your PIN.",
  NAGAD: "You'll approve the payment in your Nagad app. TurfChai never sees your PIN.",
  CARD: 'Card payments are processed securely — TurfChai never stores your card number.',
};

const POLICY = [
  {
    id: 'free',
    tone: 'ok',
    icon: <polyline points="20 6 9 17 4 12" />,
    strokeWidth: '2.5',
    body: 'Free cancellation 24h or more before your slot',
  },
  {
    id: 'half',
    tone: 'warn',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    strokeWidth: '2.5',
    body: '50% refund 6–24h before your slot',
  },
  {
    id: 'none',
    tone: 'no',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
    strokeWidth: '2.5',
    body: 'No refund within 6h of your slot',
  },
  {
    id: 'window',
    tone: '',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    strokeWidth: '2',
    body: 'Refunds return to your original payment method within a few days',
  },
];

const secondsUntil = (heldUntil) =>
  Math.max(0, Math.round((new Date(heldUntil).getTime() - Date.now()) / 1000));

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

  const [method, setMethod] = useState('BKASH');
  const [understood, setUnderstood] = useState(true);
  const [applyWallet, setApplyWallet] = useState(false);
  const [hold, setHold] = useState(() =>
    slotId ? { state: 'holding', heldUntil: null, message: '' } : { state: 'idle', heldUntil: null, message: '' },
  );
  const [slotInfo, setSlotInfo] = useState(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState(null);

  const wallet = useApi(() => getMyPoints(), []);
  const walletBalance = wallet.data?.walletBalance ?? 0;
  const slotPrice = slotInfo?.price ?? null;
  const walletApplied = applyWallet && slotPrice != null ? Math.min(walletBalance, slotPrice) : 0;
  const dueNow = slotPrice != null ? Math.max(0, slotPrice - walletApplied) : null;

  const acquireHold = useCallback(async () => {
    try {
      const result = await holdSlot(slotId);
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

  const attemptPayment = async (simulateFailure) => {
    if (!slotId || busy || hold.state !== 'held') return;
    setBusy(true);
    setPayError(null);
    try {
      const result = await checkout({
        slotId,
        method,
        applyWalletAmount: !simulateFailure && walletApplied > 0 ? walletApplied : undefined,
        simulateFailure,
      });
      if (result.status === 'SUCCESS') {
        navigate(`${paths.player.bookingSuccess}?bookingId=${result.bookingId}`, {
          state: { pointsEarned: result.pointsEarned, method },
        });
      } else {
        setPayError(result.payment?.failureReason || result.message || 'Payment declined — please try again.');
      }
    } catch (error) {
      if (error.status === 409) {
        showToast('Slot was taken while you were paying — locking it again');
        const reheld = await rehold();
        if (!reheld) showToast('Slot is no longer available — please pick another time slot');
      } else {
        showToast(error.message || 'Payment could not be completed — try again');
      }
    } finally {
      setBusy(false);
    }
  };

  const onPay = () => attemptPayment(false);
  const onSimulateFailure = () => attemptPayment(true);

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
          <Link className="btn btn-tertiary btn-sm" to={paths.player.explore} style={{ paddingLeft: 0 }}>
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
            Back to venues
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

        {payError ? (
          <div className="alert warn" role="status" style={{ marginBottom: 20 }}>
            <span className="ico">⚠️</span>
            <div>
              <b>Payment declined</b>
              {payError}
            </div>
          </div>
        ) : null}

        <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>Confirm and pay</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
          Your slot is held for 5 minutes — no one else can take it while you pay.
        </p>

        <div className="co-grid">
          <div>
            {/* Step 1: Payment method */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  1
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
                <Photo />
              </div>
              <div>
                <div className="co-venue-name">{slotInfo?.pitchName ?? 'Your pitch'}</div>
                <div className="co-venue-sub">
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

            <div style={{ marginBottom: 8 }}>
              <div className="pricerow">
                <span className="pr-label">Slot</span>
                <span className="pr-val num">{bdt(slotPrice)}</span>
              </div>
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
              <span className="pr-label">Due now</span>
              <span className="pr-val num">{bdt(dueNow)}</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              block
              id="pay-cta"
              onClick={onPay}
              loading={busy}
              disabled={hold.state !== 'held' || !understood}
              style={{ marginTop: 16 }}
            >
              Pay {bdt(dueNow)} with {methodLabel}
            </Button>
            <Button
              variant="tertiary"
              block
              onClick={onSimulateFailure}
              disabled={hold.state !== 'held' || busy}
              style={{ marginTop: 6, fontSize: 13 }}
            >
              Simulate failed payment
            </Button>
          </aside>
        </div>
      </main>
    </>
  );
}
