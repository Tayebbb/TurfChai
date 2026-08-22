import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { getShareDetails, completeSharePayment } from '@/api/splitPayment';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';
import { toUserMessage } from '@/utils/errorMessage';
import './PaySharePage.css';

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

const METHODS = [
  { id: 'BKASH', label: 'bKash', logo: 'bK', color: '#D12053' },
  { id: 'NAGAD', label: 'Nagad', logo: 'N', color: '#F26522' },
  { id: 'CARD', label: 'Card', logo: CARD_ICON, color: '#2660D8' },
];

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

function formatDeadline(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaySharePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { showToast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState('BKASH');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  const { data: share, loading, error, reload } = useApi(
    () => (token ? getShareDetails(token) : Promise.reject(new Error('No share token provided'))),
    [token],
  );

  const handleCompletePayment = async () => {
    if (!token || paying) return;
    setPaying(true);
    setPayError(null);
    try {
      await completeSharePayment(token, {
        paymentMethod: selectedMethod,
      });
      showToast('Payment completed successfully 🎉');
      reload();
    } catch (err) {
      setPayError(toUserMessage(err, 'Could not complete payment. Please try again.'));
    } finally {
      setPaying(false);
    }
  };

  if (!token) {
    return (
      <main className="wrap pay-share-wrap" id="main">
        <PageTitle title="Split Payment" />
        <div className="pay-share-card center">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Invalid Share Link</h2>
          <p className="subtle">No share token was found in this link. Please ask your host for a new link.</p>
          <div style={{ marginTop: 20 }}>
            <Button variant="primary" to={paths.player.explore}>
              Explore Turfs
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="wrap pay-share-wrap" id="main">
        <PageTitle title="Loading Share Payment…" />
        <div className="pay-share-card center">
          <p className="subtle" role="status">Loading match &amp; share details…</p>
        </div>
      </main>
    );
  }

  if (error || !share) {
    return (
      <main className="wrap pay-share-wrap" id="main">
        <PageTitle title="Share Payment" />
        <div className="pay-share-card center">
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Share Link Not Found</h2>
          <p className="subtle">{error?.message || 'This split payment link is invalid or has expired.'}</p>
          <div style={{ marginTop: 20 }}>
            <Button variant="secondary" to={paths.player.explore}>
              Browse Venues
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const isPaid = share.paymentStatus === 'PAID';
  const isExpired = share.isExpired && !isPaid;
  const playTime = share.startTime && share.endTime
    ? `${formatTime(share.startTime)} – ${formatTime(share.endTime)}`
    : '—';

  return (
    <main className="wrap pay-share-wrap" id="main">
      <PageTitle title={`Pay Share · ${share.venueName}`} />

      <div className="pay-share-card">
        <div className="pay-share-header">
          <span className={`pay-share-badge ${isPaid ? 'paid' : isExpired ? 'expired' : 'pending'}`}>
            {isPaid ? '✓ Paid & Confirmed' : isExpired ? '⚠️ Deadline Expired' : '⏱️ Split Share Pending'}
          </span>
          <h1 style={{ fontSize: 22, margin: '4px 0 2px' }}>{share.venueName}</h1>
          <p className="subtle small" style={{ margin: 0 }}>
            Hosted by <b>{share.hostName}</b> · Booking ref <b>{share.bookingCode}</b>
          </p>
        </div>

        {/* Amount Box */}
        <div className="pay-share-amount-box">
          <span className="tiny subtle" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
            YOUR SHARE TO PAY
          </span>
          <div className="pay-share-amount-val">{formatBdt(share.shareAmount)}</div>
          <span className="tiny subtle">
            1 of {share.totalPlayers} player spots · Total slot price {formatBdt(share.totalBookingAmount)}
          </span>
        </div>

        {/* Slot details summary */}
        <div className="pay-share-details-grid">
          <div className="pay-share-cell">
            <div className="pay-share-cell-label">Date &amp; Time</div>
            <div className="pay-share-cell-val">
              {formatDate(share.bookingDate)}
              <br />
              <span className="num" style={{ fontSize: 13, color: 'var(--brand)' }}>{playTime}</span>
            </div>
          </div>

          <div className="pay-share-cell">
            <div className="pay-share-cell-label">Pitch / Court</div>
            <div className="pay-share-cell-val">{share.pitchName}</div>
          </div>

          <div className="pay-share-cell">
            <div className="pay-share-cell-label">Location</div>
            <div className="pay-share-cell-val">
              {[share.venueArea, share.venueAddress].filter(Boolean).join(', ') || share.venueName}
            </div>
          </div>

          <div className="pay-share-cell">
            <div className="pay-share-cell-label">Squad Progress</div>
            <div className="pay-share-cell-val">
              <span className="badge green nodot" style={{ marginRight: 6 }}>
                {share.paidCount} / {share.totalPlayers} paid
              </span>
            </div>
          </div>
        </div>

        {share.splitDeadline ? (
          <div className="alert info" style={{ margin: '14px 0', fontSize: 12.5 }}>
            <span className="ico" aria-hidden="true">⏱️</span>
            <div>
              <b>Payment deadline:</b> {formatDeadline(share.splitDeadline)}
            </div>
          </div>
        ) : null}

        {isPaid ? (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                margin: '0 auto 12px',
                border: '2px solid var(--brand)',
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>You&apos;re All Set!</h3>
            <p className="subtle small" style={{ maxWidth: 360, margin: '0 auto 16px' }}>
              Your {formatBdt(share.shareAmount)} share has been marked as paid. Your host has been notified.
            </p>
            <Button variant="primary" to={paths.player.explore}>
              Explore More Turfs
            </Button>
          </div>
        ) : isExpired ? (
          <div className="alert warn" style={{ margin: '16px 0' }}>
            <span className="ico">⚠️</span>
            <div>
              <b>This split payment window has expired.</b> Please reach out to your host ({share.hostName}) to settle the payment.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Select Payment Method</h3>
            <div className="pay-share-method-grid" style={{ marginBottom: 16 }}>
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`pay-share-method-btn ${selectedMethod === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMethod(m.id)}
                >
                  <span
                    style={{
                      background: m.color,
                      color: '#fff',
                      borderRadius: 6,
                      width: 28,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {m.logo}
                  </span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {payError ? (
              <div className="alert warn" role="status" style={{ marginBottom: 12 }}>
                <span className="ico">⚠️</span>
                <div>{payError}</div>
              </div>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              block
              onClick={handleCompletePayment}
              loading={paying}
              disabled={paying}
            >
              {paying
                ? 'Processing…'
                : `Complete payment · ${formatBdt(share.shareAmount)} via ${METHODS.find((m) => m.id === selectedMethod)?.label}`}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
