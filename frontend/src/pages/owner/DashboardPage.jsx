import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { KpiCard } from '@/components/cards/KpiCard';
import { Card, GlassCard } from '@/components/cards/Card';
import { Input } from '@/components/forms/Field';
import { Icon } from '@/components/common/Icon';
import { Overlay } from '@/components/modals/Overlay';
import { ManualBookingModal } from '@/components/modals/ManualBookingModal';
import { PageTitle } from '@/components/common/PageTitle';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/utils/cn';
import { getOwnerAnalytics } from '@/api/ownerAnalytics';
import { getOwnerBookings } from '@/api/ownerBookings';
import { checkInBooking } from '@/api/bookings';
import { listMyVenues } from '@/api/ownerVenues';
import { getMyTurfRequests } from '@/api/turfRequests';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';
import { useState, useRef, useEffect, useCallback } from 'react';
import './DashboardPage.css';

/** The greeting was hardcoded to "Good evening" regardless of the clock. */
function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Displays verification document status and allows preview if URL is stored. */
function DocumentState({ value, label, onPreview }) {
  if (!value || value === 'PENDING') return <b className="subtle">Not provided</b>;
  if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:'))) {
    return (
      <span
        onClick={() => onPreview && onPreview({ label, url: value })}
        style={{ color: 'var(--brand-500)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
        title="Click to view document"
      >
        Attached (View ↗)
      </span>
    );
  }
  return <b style={{ color: 'var(--brand-500)' }} title={value}>Attached ✓</b>;
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const scanner = useDisclosure(false);
  const manualBookingModal = useDisclosure(false);
  const [scanResult, setScanResult] = useState(null);
  const [ticketRef, setTicketRef] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraError(null);
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported on this browser/device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(toUserMessage(err, 'Could not access camera. Please allow camera permissions.'));
    }
  };

  useEffect(() => {
    if (!scanner.isOpen) {
      stopCamera();
    }
  }, [scanner.isOpen, stopCamera]);

  const { data: bookingsRes, reload: reloadBookings } = useApi(getOwnerBookings, []);
  const ownerBookings = Array.isArray(bookingsRes)
    ? bookingsRes
    : (Array.isArray(bookingsRes?.data) ? bookingsRes.data : []);

  /**
   * Real gate check-in via typed reference or camera scan.
   */
  async function checkInTicket(event, directRef) {
    event?.preventDefault();
    const typed = (directRef || ticketRef).trim();
    if (!typed || checkingIn) return;

    // The ticket QR encodes a booking-detail URL, so a pasted link works too.
    const reference = typed.split('/').filter(Boolean).pop() ?? typed;
    const match = ownerBookings.find(
      (row) =>
        String(row.bookingCode ?? '').toLowerCase() === reference.toLowerCase() ||
        String(row.id) === reference,
    );

    let bookingIdToCall = match?.id;
    if (!bookingIdToCall && /^\d+$/.test(reference)) {
      bookingIdToCall = Number(reference);
    }

    if (!bookingIdToCall) {
      setScanResult({ tone: 'danger', title: 'No such booking at your venue', body: `"${reference}" does not match any booking on your pitches.` });
      return;
    }

    setCheckingIn(true);
    try {
      await checkInBooking(bookingIdToCall);
    } catch (error) {
      setScanResult({
        tone: 'danger',
        title: 'Check-in refused',
        body: toUserMessage(error, 'The server would not record this check-in.'),
      });
      return;
    } finally {
      setCheckingIn(false);
    }

    setScanResult({
      tone: 'ok',
      title: `Checked in — ${match?.bookingCode ?? reference}`,
      body: match ? `${match.customer ?? 'Player'} · ${match.pitch ?? 'Pitch'} · ${match.time ?? ''}`.trim() : 'Attendance registered on server',
    });
    setTicketRef('');
    reloadBookings();
    showToast('Attendance registered ✓');
  }

  // Auto-scan QR codes if BarcodeDetector is available
  useEffect(() => {
    if (!cameraActive || typeof window === 'undefined' || !window.BarcodeDetector) return;
    let cancelled = false;
    let detector;
    try {
      detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
    } catch {
      return;
    }

    const interval = setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes?.length > 0 && !cancelled) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            stopCamera();
            checkInTicket(null, rawValue);
          }
        }
      } catch {
        // ignore frame scan errors
      }
    }, 450);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraActive, stopCamera]);

  const { user: owner } = useSession();

  const { data: venuesRes, reload: reloadVenues } = useApi(listMyVenues, [], { intervalMs: 30000 });
  const venues = venuesRes?.data || venuesRes || [];
  const activeVenue = venues[0];

  const { data: requestsRes, reload: reloadRequests } = useApi(getMyTurfRequests, [], { intervalMs: 20000 });
  const myRequests = Array.isArray(requestsRes) ? requestsRes : [];
  const latestRequest = myRequests[0] || null;

  const isPendingVerification = latestRequest?.status === 'PENDING' || (!activeVenue && latestRequest);

  const { data: analyticsRes, loading, reload: reloadAnalytics } = useApi(getOwnerAnalytics, []);
  const analyticsData = analyticsRes?.data || analyticsRes || {};

  const rawKpis = analyticsData.kpis;
  const KPIS = Array.isArray(rawKpis)
    ? rawKpis
    : (rawKpis && typeof rawKpis === 'object'
        ? [
            // A missing figure is not a measured zero.
            { label: "Today's revenue", value: rawKpis.revenue || '—' },
            { label: 'Bookings today', value: rawKpis.booked || '—' },
            { label: 'Occupancy', value: rawKpis.occupancy || '—' },
            { label: 'Pending payments', value: rawKpis.pending || '—' },
          ]
        : []);

  const NEXT_UP = Array.isArray(analyticsData.nextUp) ? analyticsData.nextUp : [];
  const ACTIVITY = Array.isArray(analyticsData.activity) ? analyticsData.activity : [];
  const ATTENTION = Array.isArray(analyticsData.attention) ? analyticsData.attention : [];
  const WEEKLY = analyticsData.weekly ?? {};

  const channelTotal = Number(WEEKLY.onlineBookings ?? 0) + Number(WEEKLY.manualBookings ?? 0);
  const weekOnWeek = (() => {
    const previous = Number(WEEKLY.previousRevenue ?? 0);
    const current = Number(WEEKLY.revenue ?? 0);
    if (previous === 0) return current === 0 ? 'No takings in either week' : 'No takings the week before';
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change >= 0 ? '+' : ''}${change}% vs the previous 7 days`;
  })();

  let requestPhotos = [];
  if (latestRequest?.photosJson) {
    try {
      requestPhotos = JSON.parse(latestRequest.photosJson);
    } catch {
      requestPhotos = [];
    }
  }

  return (
    <>
      <PageTitle title="Dashboard" />

      {/* Verification Pending Banner / Account Lock Card */}
      {isPendingVerification ? (
        <div style={{ maxWidth: 860, margin: '16px auto 32px' }}>
          <Alert tone="amber" icon="⏳" title="Venue Verification Pending (Account Locked)" style={{ marginBottom: 20, padding: 18 }}>
            Your venue registration request for <b>{latestRequest?.venueName || 'Your Venue'}</b> is currently under review by the TurfChai admin team.
            Core operational features (live QR scanner, manual slot bookings, ledger payouts) will unlock automatically once approved.
          </Alert>

          <GlassCard style={{ padding: 24, marginBottom: 20 }}>
            <div className="between" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>{latestRequest?.venueName || 'My Venue'}</h2>
                <span className="subtle small">
                  Request Code: <b className="num">{latestRequest?.requestCode || '—'}</b> · Area: {latestRequest?.area || '—'}
                </span>
              </div>
              <Badge tone="amber">Status: PENDING ADMIN APPROVAL</Badge>
            </div>

            <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="panel stack-sm" style={{ padding: 14 }}>
                <span className="tiny subtle">PITCH & SPORTS DETAILS</span>
                <div className="between small">
                  <span className="muted">Pitch Count</span>
                  <b>{latestRequest?.pitchCount ? `${latestRequest.pitchCount} pitch(es)` : '—'}</b>
                </div>
                <div className="between small">
                  <span className="muted">Sports Supported</span>
                  <b>{latestRequest?.sportsCsv || '—'}</b>
                </div>
                <div className="between small">
                  <span className="muted">Owner Phone</span>
                  <b className="num">{latestRequest?.ownerPhone || '—'}</b>
                </div>
              </div>

              <div className="panel stack-sm" style={{ padding: 14 }}>
                <span className="tiny subtle">VERIFICATION DOCUMENTS</span>
                <div className="between small">
                  <span className="muted">Trade License</span>
                  <DocumentState value={latestRequest?.docTradeLicense} label="Trade License" onPreview={setPreviewDoc} />
                </div>
                <div className="between small">
                  <span className="muted">Owner NID</span>
                  {latestRequest?.docOwnerNid && (latestRequest.docOwnerNid.startsWith('http') || latestRequest.docOwnerNid.startsWith('data:')) ? (
                    <DocumentState value={latestRequest.docOwnerNid} label="Owner NID" onPreview={setPreviewDoc} />
                  ) : (
                    <b className="num">{latestRequest?.docOwnerNid || 'Not provided'}</b>
                  )}
                </div>
                <div className="between small">
                  <span className="muted">Utility / Lease Proof</span>
                  <DocumentState value={latestRequest?.docUtilityBill} label="Utility / Lease Proof" onPreview={setPreviewDoc} />
                </div>
              </div>
            </div>

            {/* Submitted Pitch Photos Gallery */}
            {requestPhotos.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <span className="subtle small" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Submitted Pitch Photos ({requestPhotos.length}):
                </span>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  {requestPhotos.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Pitch photo ${idx + 1}`}
                      onClick={() => setPreviewPhoto(url)}
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--border-soft)',
                        cursor: 'pointer',
                      }}
                      title="Click to view photo"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="row" style={{ marginTop: 24, gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" to={paths.owner.onboarding}>
                Edit Onboarding Request ✏️
              </Button>
              <Button variant="primary" onClick={() => { reloadRequests(); reloadVenues(); showToast('Checking verification status…'); }}>
                Check Verification Status 🔄
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}

      <div className="main-header">
        <div>
          <h1>
            {greeting()}, {owner?.fullName || 'there'} 🏟️
          </h1>
          <span className="subtle small">
            {activeVenue ? `${activeVenue.name} · ${activeVenue.area} · ` : (latestRequest ? `${latestRequest.venueName} · ` : 'My Venue · ')}
            <Badge tone={isPendingVerification ? 'amber' : 'green'}>{isPendingVerification ? 'Pending Approval' : 'Live'}</Badge>
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" to={paths.owner.calendar} disabled={isPendingVerification}>🗓️ Calendar</Button>
          <Button variant="secondary" onClick={manualBookingModal.open} disabled={isPendingVerification}>+ Manual booking</Button>
          <Button variant="primary" onClick={scanner.open} disabled={isPendingVerification}>
            📷 Scan player QR
          </Button>
        </div>
      </div>

      {/* Operational KPI Summary Grid */}
      <div className="grid4" style={{ marginBottom: 20 }}>
        {KPIS.map((kpi, idx) => {
          const actionLink = idx === 0
            ? { to: paths.owner.payments, label: 'Ledger →' }
            : idx === 1
              ? { to: paths.owner.bookings, label: 'All Bookings →' }
              : idx === 2
                ? { to: paths.owner.calendar, label: 'Schedule →' }
                : { to: paths.owner.bookings, label: 'Review Pending →' };
          return (
            <div key={kpi.label} className="liquid-glass kpi-card">
              <div>
                <div className="between">
                  <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                    {kpi.label}
                  </span>
                  <Icon
                    name={idx === 0 ? 'money' : idx === 1 ? 'calendar' : idx === 2 ? 'activity' : 'alert'}
                    style={{
                      color: idx === 0 ? 'var(--brand)' : idx === 1 ? 'var(--info)' : idx === 2 ? 'var(--brand)' : 'var(--warn)',
                    }}
                  />
                </div>
                <b className="value num" style={{ fontSize: 32, display: 'block', margin: '6px 0 2px' }}>
                  {kpi.value}
                </b>
                {kpi.delta && (
                  <span className={cn('delta', kpi.trend)} style={{ fontSize: 12 }}>
                    {kpi.delta}
                  </span>
                )}
              </div>
              <Link
                className={cn('btn btn-sm btn-secondary btn-link', isPendingVerification && 'disabled')}
                to={actionLink.to}
                style={isPendingVerification ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
              >
                {actionLink.label}
              </Link>
            </div>
          );
        })}
        {loading && <div className="tiny subtle center">Loading KPIs...</div>}
      </div>

      {/* 2-Column Minimal Operational Grid */}
      <div className="grid2" style={{ alignItems: 'start' }}>
        {/* Left Column: Pitch Schedule & Live Activity */}
        <div className="stack">
          <section className="card">
            <div className="between" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Next up on your pitches</h2>
              <Link className="btn btn-sm btn-tertiary" to={paths.owner.calendar}>
                View schedule →
              </Link>
            </div>
            <div className="stack-sm">
                {NEXT_UP.map((row) => (
                  <div className="panel between" key={row.id}>
                    <div>
                      <b className="small num">{row.slot}</b>{' '}
                      <Badge tone={row.badge.tone} dot={false}>
                        {row.badge.text}
                      </Badge>
                      <div className="tiny subtle">{row.detail}</div>
                    </div>
                    {row.action.kind === 'link' ? (
                      <Button size="sm" variant={row.action.variant} to={row.action.to}>
                        {row.action.label}
                      </Button>
                    ) : null}
                  </div>
                ))}
                {!loading && NEXT_UP.length === 0 && <div className="tiny subtle center">No upcoming slots</div>}
              </div>
          </section>

          <section className="card">
            <div className="between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Recent activity</h3>
              <Link className="btn btn-sm btn-tertiary" to={paths.owner.payments}>
                Ledger →
              </Link>
            </div>
            <ul className="tline">
              {ACTIVITY.map((item) => (
                <li key={item.id}>
                  <b className="small">{item.title}</b>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    {item.detail}
                  </p>
                </li>
              ))}
              {!loading && ACTIVITY.length === 0 && <li className="tiny subtle center">No recent activity</li>}
            </ul>
          </section>
        </div>

        {/* Right Column: Priority Alerts & Weekly Performance */}
        <div className="stack">
          <section className="card">
            <div className="between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Needs attention</h3>
              {/* The pill was a literal 3, sitting above an empty list. */}
              {ATTENTION.length > 0 ? <span className="countpill">{ATTENTION.length}</span> : null}
            </div>
            <div className="stack-sm">
              {ATTENTION.map((item) => (
                <Alert key={item.id} tone={item.tone} icon={item.icon} title={item.title} style={{ margin: 0 }}>
                  {item.body}
                  <Link to={item.link.to}>{item.link.label}</Link>
                </Alert>
              ))}
              {!loading && ATTENTION.length === 0 && <div className="tiny subtle center">All good!</div>}
            </div>
          </section>

          <section className="card">
            <h3 style={{ marginBottom: 12 }}>Last 7 days</h3>
            <div className="stack-sm">
              <div>
                <div className="between small">
                  <span className="muted">Takings</span>
                  <b className="num">৳{Number(WEEKLY.revenue ?? 0).toLocaleString('en-BD')}</b>
                </div>
                <span className="tiny subtle">{weekOnWeek}</span>
              </div>
              <div>
                <div className="between small">
                  <span className="muted">Occupancy</span>
                  <b className="num">
                    {WEEKLY.occupancyPercent == null ? '—' : `${WEEKLY.occupancyPercent}%`}
                  </b>
                </div>
                <Progress value={WEEKLY.occupancyPercent ?? 0} label="Occupancy over the last 7 days" />
                <span className="tiny subtle">
                  {WEEKLY.slotsPublished
                    ? `${WEEKLY.slotsBooked} of ${WEEKLY.slotsPublished} slots booked`
                    : 'No slots published for this week'}
                </span>
              </div>
            </div>
            <div className="between small" style={{ marginTop: 14 }}>
              <span className="muted">Booking source</span>
            </div>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              {channelTotal === 0 ? (
                <span className="tiny subtle">No confirmed bookings in the last 7 days.</span>
              ) : (
                <>
                  <Badge tone="green" dot={false}>
                    Online {Math.round((100 * (WEEKLY.onlineBookings ?? 0)) / channelTotal)}%
                  </Badge>
                  <Badge tone="blue" dot={false}>
                    Manual {Math.round((100 * (WEEKLY.manualBookings ?? 0)) / channelTotal)}%
                  </Badge>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <Overlay isOpen={scanner.isOpen} onClose={scanner.close} title="Check in a player" maxWidth={460}>
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Gate check-in · scan the player&apos;s ticket QR code with camera, enter the reference on their match ticket, or paste the link.
        </p>

        {cameraActive ? (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '100%', height: 220, borderRadius: 14, overflow: 'hidden', background: '#09150e', border: '1px solid var(--glass-border)' }}>
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, border: '2px dashed var(--brand)', margin: 24, borderRadius: 12, pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 8, gap: 8 }}>
              <Button size="sm" variant="secondary" onClick={stopCamera}>
                ⏹️ Stop Camera Scan
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <Button size="sm" variant="secondary" block onClick={startCamera}>
              📷 Open Camera QR Scanner
            </Button>
          </div>
        )}

        {cameraError ? (
          <Alert tone="warn" icon="⚠️" style={{ marginBottom: 10 }}>
            {cameraError}
          </Alert>
        ) : null}

        <form onSubmit={checkInTicket}>
          <div className="field">
            <label htmlFor="ticket-ref">Booking reference / QR code</label>
            <Input
              id="ticket-ref"
              placeholder="e.g. TC-48291 or booking ID"
              value={ticketRef}
              onChange={(event) => setTicketRef(event.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" block disabled={!ticketRef.trim() || checkingIn}>
            {checkingIn ? 'Checking in…' : 'Check in'}
          </Button>
        </form>
        <div role="status" style={{ marginTop: 12 }}>
          {scanResult ? (
            <Alert
              tone={scanResult.tone}
              icon={scanResult.tone === 'ok' ? '✅' : '⛔'}
              title={scanResult.title}
              style={{ margin: 0 }}
            >
              {scanResult.body}
            </Alert>
          ) : null}
        </div>
      </Overlay>

      {/* Photo Preview Overlay */}
      <Overlay
        isOpen={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title="Pitch Photo Preview"
        maxWidth={700}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0' }}>
          <img
            src={previewPhoto}
            alt="Venue pitch preview"
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }}
          />
        </div>
      </Overlay>

      {/* Verification Document Preview Overlay */}
      <Overlay
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.label || 'Document Preview'}
        maxWidth={850}
      >
        <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {previewDoc?.url?.toLowerCase().includes('.pdf') || previewDoc?.url?.startsWith('data:application/pdf') ? (
            <iframe
              src={previewDoc.url}
              width="100%"
              height="100%"
              style={{ border: 'none', borderRadius: 8, background: '#fff' }}
              title={previewDoc.label}
            />
          ) : (
            <img
              src={previewDoc?.url}
              alt="Document preview"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
            />
          )}
          <div className="row" style={{ gap: 12, marginTop: 8 }}>
            <a
              href={previewDoc?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-secondary"
            >
              Open in New Window ↗
            </a>
            <Button
              variant="tertiary"
              onClick={() => setPreviewDoc(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Overlay>

      {/* Manual Booking Modal */}
      <ManualBookingModal
        isOpen={manualBookingModal.isOpen}
        onClose={manualBookingModal.close}
        onSuccess={() => {
          reloadBookings();
          reloadAnalytics();
          reloadVenues();
        }}
        initialVenueId={activeVenue?.id}
      />
    </>
  );
}