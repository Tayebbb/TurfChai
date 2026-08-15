import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { KpiCard } from '@/components/cards/KpiCard';
import { Card, GlassCard } from '@/components/cards/Card';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { Progress } from '@/components/ui/Progress';
import { getMyProfile } from '@/api/players';
import { getOwnerAnalytics } from '@/api/ownerAnalytics';
import { listMyVenues } from '@/api/ownerVenues';
import { getMyTurfRequests } from '@/api/turfRequests';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useState } from 'react';
import './DashboardPage.css';

export default function DashboardPage() {
  const { showToast } = useToast();
  const scanner = useDisclosure(false);
  const [scanResult, setScanResult] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  /** Simulated gate scan: `ok` matches the current slot, `bad` is a slot mismatch. */
  function simulateScan(result) {
    setScanResult(result);
    showToast(
      result === 'ok' ? '✅ Checked in — attendance registered' : '⛔ QR does not match this slot',
    );
  }

  const profileApi = useApi(() => getMyProfile(), []);
  const owner = profileApi.data;

  const { data: venuesRes } = useApi(listMyVenues, []);
  const venues = venuesRes?.data || venuesRes || [];
  const activeVenue = venues[0];

  const { data: requestsRes } = useApi(getMyTurfRequests, []);
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
              <Button variant="primary" onClick={() => showToast('Refreshed status — still pending approval ⏳')}>
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

      <div className="main-header" style={isPendingVerification ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
        <div>
          <h1>Good evening, {owner?.name ?? 'Owner'} 🏟️</h1>
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
              <h3 style={{ margin: 0 }}>Next up on your pitches</h3>
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
                    ) : (
                      <Button size="sm" variant={row.action.variant} onClick={() => showToast(row.action.toast)}>
                        {row.action.label}
                      </Button>
                    )}
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
              <span className="countpill">3</span>
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
            <h3 style={{ marginBottom: 12 }}>Weekly performance</h3>
            <div className="stack-sm">
              <div>
                <div className="between small">
                  <span className="muted">Revenue goal</span>
                  <b className="num">৳96,700 / ৳110,000 (88%)</b>
                </div>
                <Progress value={88} label="Revenue goal" />
              </div>
              <div>
                <div className="between small">
                  <span className="muted">Occupancy rate</span>
                  <b className="num">68%</b>
                </div>
                <Progress value={68} label="Occupancy rate" />
              </div>
            </div>
            <div className="between small" style={{ marginTop: 14 }}>
              <span className="muted">Booking channels</span>
            </div>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <Badge tone="green" dot={false}>
                Online 61%
              </Badge>
              <Badge tone="amber" dot={false}>
                Phone 22%
              </Badge>
              <Badge tone="blue" dot={false}>
                Walk-in 17%
              </Badge>
            </div>
          </section>
        </div>
      </div>

      <Overlay isOpen={scanner.isOpen} onClose={scanner.close} title="Scan player QR" maxWidth={440}>
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Gate check-in · verifying against <b>Pitch 2 · 7:30–9:00 PM</b> (current slot)
        </p>
        <div className="viewfinder" aria-hidden="true">
          <i className="scanline" />
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <div className="vf-hint">Point the camera at the player&apos;s match ticket QR</div>
        </div>
        <div role="status" style={{ marginTop: 12 }}>
          {scanResult === 'ok' ? (
            <Alert tone="ok" icon="✅" title="Access granted — TC-48291" style={{ margin: 0 }}>
              Player · 10 players · Pitch 2 · 7:30–9:00 PM
              <br />
              <span className="tiny">
                Ticket matches this slot &amp; time · checked in 7:21 PM · attendance auto-registered
              </span>
            </Alert>
          ) : null}
          {scanResult === 'bad' ? (
            <Alert tone="danger" icon="⛔" title="Access denied — slot mismatch" style={{ margin: 0 }}>
              TC-47110 is for 9:00 PM · Pitch 3, not this gate’s current slot.
              <br />
              <span className="tiny">
                Ask the player to wait for their slot, or open the booking to verify manually.
              </span>
            </Alert>
          ) : null}
        </div>
        <div className="grid2" style={{ gap: 8, marginTop: 12 }}>
          <Button onClick={() => simulateScan('ok')}>Simulate scan · valid</Button>
          <Button onClick={() => simulateScan('bad')}>Simulate · wrong slot</Button>
        </div>
        <p className="tiny subtle" style={{ margin: '10px 0 0' }}>
          A valid scan matches the ticket&apos;s booking to this pitch, date and time window, grants entry, and
          auto-registers attendance — no manual entry needed.
        </p>
      </Overlay>
    </>
  );
}