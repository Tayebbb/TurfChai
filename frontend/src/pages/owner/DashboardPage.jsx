import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { KpiCard } from '@/components/cards/KpiCard';
import { Card, GlassCard } from '@/components/cards/Card';
import { Input } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { Progress } from '@/components/ui/Progress';
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
import { useState } from 'react';
import './DashboardPage.css';

/** The greeting was hardcoded to "Good evening" regardless of the clock. */
function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const scanner = useDisclosure(false);
  const [scanResult, setScanResult] = useState(null);
  const [ticketRef, setTicketRef] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const { data: bookingsRes, reload: reloadBookings } = useApi(getOwnerBookings, []);
  const ownerBookings = Array.isArray(bookingsRes)
    ? bookingsRes
    : (Array.isArray(bookingsRes?.data) ? bookingsRes.data : []);

  /**
   * Real gate check-in. This used to be two "Simulate scan" buttons that
   * toasted "attendance registered" without contacting the server, quoting
   * booking references that do not exist.
   */
  async function checkInTicket(event) {
    event.preventDefault();
    const typed = ticketRef.trim();
    if (!typed || checkingIn) return;

    // The ticket QR encodes a booking-detail URL, so a pasted link works too.
    const reference = typed.split('/').filter(Boolean).pop() ?? typed;
    const match = ownerBookings.find(
      (row) =>
        String(row.bookingCode ?? '').toLowerCase() === reference.toLowerCase() ||
        String(row.id) === reference,
    );

    if (!match) {
      setScanResult({ tone: 'danger', title: 'No such booking at your venue', body: `"${reference}" does not match any booking on your pitches.` });
      return;
    }

    setCheckingIn(true);
    try {
      await checkInBooking(match.id);
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
      title: `Checked in — ${match.bookingCode ?? match.id}`,
      body: `${match.customer ?? 'Player'} · ${match.pitch ?? 'Pitch'} · ${match.time ?? ''}`.trim(),
    });
    setTicketRef('');
    reloadBookings();
    showToast('Attendance registered');
  }

  const { user: owner } = useSession();

  const { data: venuesRes } = useApi(listMyVenues, [], { intervalMs: 30000 });
  const venues = venuesRes?.data || venuesRes || [];
  const activeVenue = venues[0];

  const { data: requestsRes, reload: reloadRequests } = useApi(getMyTurfRequests, [], { intervalMs: 20000 });
  const myRequests = Array.isArray(requestsRes) ? requestsRes : [];
  const latestRequest = myRequests[0] || null;

  const isPendingVerification = latestRequest?.status === 'PENDING' || (!activeVenue && latestRequest);

  const { data: analyticsRes, loading } = useApi(getOwnerAnalytics, []);
  const analyticsData = analyticsRes?.data || analyticsRes || {};

  const rawKpis = analyticsData.kpis;
  const KPIS = Array.isArray(rawKpis)
    ? rawKpis
    : (rawKpis && typeof rawKpis === 'object'
        ? [
            { label: "Today's revenue", value: rawKpis.revenue || '৳0' },
            { label: 'Bookings today', value: rawKpis.booked || '0' },
            { label: 'Occupancy', value: rawKpis.occupancy || '0%' },
            { label: 'Pending payments', value: rawKpis.pending || '0' },
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
                  Request Code: <b className="num">{latestRequest?.requestCode || 'TRF-1042'}</b> · Area: {latestRequest?.area || 'Dhanmondi'}
                </span>
              </div>
              <Badge tone="amber">Status: PENDING ADMIN APPROVAL</Badge>
            </div>

            <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="panel stack-sm" style={{ padding: 14 }}>
                <span className="tiny subtle">PITCH & SPORTS DETAILS</span>
                <div className="between small">
                  <span className="muted">Pitch Count</span>
                  <b>{latestRequest?.pitchCount || 1} pitch(es)</b>
                </div>
                <div className="between small">
                  <span className="muted">Sports Supported</span>
                  <b>{latestRequest?.sportsCsv || 'Football'}</b>
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
                  <b style={{ color: 'var(--brand-500)' }}>{latestRequest?.docTradeLicense || 'Attached ✓'}</b>
                </div>
                <div className="between small">
                  <span className="muted">Owner NID</span>
                  <b style={{ color: 'var(--brand-500)' }}>{latestRequest?.docOwnerNid || 'Attached ✓'}</b>
                </div>
                <div className="between small">
                  <span className="muted">Utility / Lease Proof</span>
                  <b style={{ color: 'var(--brand-500)' }}>{latestRequest?.docUtilityBill || 'Attached ✓'}</b>
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
              <Button variant="primary" onClick={() => { reloadRequests(); showToast('Checking verification status…'); }}>
                Check Verification Status 🔄
              </Button>
            </div>
          </GlassCard>

          {/* Photo Preview Modal */}
          <Overlay isOpen={!!previewPhoto} onClose={() => setPreviewPhoto(null)} title="Venue Pitch Photo Preview" maxWidth={680}>
            <div style={{ textAlign: 'center', padding: 12 }}>
              <img src={previewPhoto} alt="Venue preview" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 12, objectFit: 'contain' }} />
            </div>
          </Overlay>
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
        <div className="row">
          <Button to={paths.owner.calendar} disabled={isPendingVerification}>🗓️ Calendar</Button>
          <Button to={paths.owner.calendar} disabled={isPendingVerification}>+ Manual booking</Button>
          <Button variant="primary" onClick={scanner.open} disabled={isPendingVerification}>
            📷 Scan player QR
          </Button>
        </div>
      </div>

      {/* Operational KPI Summary Grid */}
      <div className="grid4" style={{ marginBottom: 20 }}>
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} trend={kpi.trend} />
        ))}
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

      <Overlay isOpen={scanner.isOpen} onClose={scanner.close} title="Check in a player" maxWidth={440}>
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Gate check-in · enter the reference on the player&apos;s match ticket, or paste the
          link their QR opens.
        </p>
        <form onSubmit={checkInTicket}>
          <div className="field">
            <label htmlFor="ticket-ref">Booking reference</label>
            <Input
              id="ticket-ref"
              placeholder="e.g. TC-48291"
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
        <p className="tiny subtle" style={{ margin: '10px 0 0' }}>
          Check-in is recorded against the real booking and shows up on the player&apos;s ticket.
          Camera scanning is not built yet, so the reference is typed in for now.
        </p>
      </Overlay>
    </>
  );
}