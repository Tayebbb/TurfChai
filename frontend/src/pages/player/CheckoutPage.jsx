import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Photo } from '@/components/ui/Photo';
import { holdSlot, createBooking } from '@/api/bookings';
import { useCountdown } from '@/hooks/useCountdown';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './CheckoutPage.css';

const PAY_OPTIONS = [
  {
    id: 'full',
    title: 'Pay full amount — ৳2,550',
    description: 'Done in one go. Best for solo captains.',
  },
  {
    id: 'deposit',
    title: 'Pay 30% deposit — ৳765',
    description: 'Rest due at the venue before kickoff. Deposit is non-refundable within 6h.',
  },
  {
    id: 'split',
    title: 'Split with my team',
    badge: 'Popular',
    description: 'Pay your share now, invite teammates to pay theirs. You stay in control.',
  },
];

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

const BANK_ICON = (
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
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const METHODS = [
  { id: 'bkash', domId: 'pay-bkash', label: 'bKash', logo: 'bK', color: '#D12053' },
  { id: 'nagad', domId: 'pay-nagad', label: 'Nagad', logo: 'N', color: '#F26522' },
  { id: 'card', domId: 'pay-card', label: 'Card', logo: CARD_ICON, color: '#2660D8' },
  { id: 'bank', domId: 'pay-bank', label: 'Bank transfer', logo: BANK_ICON, color: '#5B6B76' },
];

const POLICY = [
  {
    id: 'free',
    tone: 'ok',
    icon: <polyline points="20 6 9 17 4 12" />,
    strokeWidth: '2.5',
    body: (
      <>
        Free cancellation before <b>Thu 7 Aug, 7:30 PM</b>
      </>
    ),
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
    body: (
      <>
        50% refund until <b>Fri 8 Aug, 1:30 PM</b>
      </>
    ),
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
    body: 'No refund within 6h of kickoff',
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
    body: 'Refunds return to your bKash within 3–5 days',
  },
];

const secondsUntil = (heldUntil) =>
  Math.max(0, Math.round((new Date(heldUntil).getTime() - Date.now()) / 1000));

export default function CheckoutPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get('slotId');

  const [option, setOption] = useState('full');
  const [method, setMethod] = useState('bkash');
  const [understood, setUnderstood] = useState(true);
  const [hold, setHold] = useState(() =>
    slotId ? { state: 'holding', heldUntil: null, message: '' } : { state: 'idle', heldUntil: null, message: '' },
  );
  const [lockSeconds, setLockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

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

  const onPay = async () => {
    if (!slotId || busy || hold.state !== 'held') return;
    setBusy(true);
    try {
      const booking = await createBooking(slotId);
      navigate(`${paths.player.bookingSuccess}?bookingId=${booking.id}`);
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

  return (
    <>
      <PageTitle title="Checkout" />
      <main className="wrap" id="main" style={{ paddingTop: 28, maxWidth: 1000, paddingBottom: 60 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <Link className="btn btn-tertiary btn-sm" to={paths.player.venue('kick-off-arena')} style={{ paddingLeft: 0 }}>
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
            Back to venue
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

        <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>Confirm and pay</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
          Your slot is held for 5 minutes — no one else can take it while you pay.
        </p>

        <div className="co-grid">
          <div>
            {/* Step 1: Payment option */}
            <div className="co-step">
              <div className="co-step-header">
                <div className="co-step-num" aria-hidden="true">
                  1
                </div>
                <div className="co-step-title">Payment option</div>
              </div>
              <div className="stack-sm" role="radiogroup" aria-label="Payment option">
                {PAY_OPTIONS.map((item) => (
                  <label className="payopt" key={item.id}>
                    <input
                      type="radio"
                      name="opt"
                      checked={option === item.id}
                      onChange={() => setOption(item.id)}
                    />
                    <div className="payopt-label">
                      <b>
                        {item.title}
                        {item.badge ? (
                          <span className="badge green nodot" style={{ verticalAlign: 2 }}>
                            {item.badge}
                          </span>
                        ) : null}
                      </b>
                      <span>{item.description}</span>
                    </div>
                  </label>
                ))}
              </div>
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
              <p className="method-hint">
                You&apos;ll approve the payment in your bKash app. TurfChai never sees your PIN.
              </p>
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
                  <b>(7:30–9:00 PM, arrive 7:20 for handover)</b>.
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
                <div className="co-venue-name">Kick Off Arena</div>
                <div className="co-venue-sub">Pitch 2 &middot; 7-a-side &middot; Dhanmondi 27</div>
              </div>
            </div>

            <div className="co-detail">
              <div className="co-detail-row">
                <span className="co-detail-label">Date</span>
                <span className="co-detail-value">Fri 8 Aug</span>
              </div>
              <div className="co-detail-row">
                <span className="co-detail-label">Play time</span>
                <span className="co-detail-value num">7:30 – 9:00 PM</span>
              </div>
              <div className="co-detail-row">
                <span className="co-detail-label">Arrive by</span>
                <span className="co-detail-value">7:20 PM</span>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="pricerow">
                <span className="pr-label">Slot (90 min)</span>
                <span className="pr-val num">৳2,500</span>
              </div>
              <div className="pricerow">
                <span className="pr-label">Service fee</span>
                <span className="pr-val num">৳150</span>
              </div>
              <div className="pricerow">
                <span className="pr-label neg" style={{ color: 'var(--brand-600)' }}>
                  Off-peak discount
                </span>
                <span className="pr-val neg num">−৳0</span>
              </div>
              <div className="pricerow">
                <span className="pr-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Rewards (100 pts)
                  <button
                    className="btn btn-sm btn-tertiary"
                    type="button"
                    style={{ minHeight: 22, padding: '0 8px', fontSize: 12 }}
                    onClick={() => showToast('100 points applied')}
                  >
                    Apply
                  </button>
                </span>
                <span className="pr-val neg num">−৳100</span>
              </div>
            </div>

            <div className="pricerow total">
              <span className="pr-label">Due now</span>
              <span className="pr-val num">৳2,550</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 16px' }}>
              Remaining balance after payment: ৳0
            </p>

            <Button
              variant="primary"
              size="lg"
              block
              id="pay-cta"
              onClick={onPay}
              loading={busy}
              disabled={hold.state !== 'held' || !understood}
            >
              Pay ৳2,550 with bKash
            </Button>
            <Button
              variant="tertiary"
              block
              to={paths.player.paymentRetry}
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
