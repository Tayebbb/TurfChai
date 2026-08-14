import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { KpiCard } from '@/components/cards/KpiCard';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { Progress } from '@/components/ui/Progress';
import { getMyProfile } from '@/api/players';
import { getOwnerAnalytics } from '@/api/ownerAnalytics';
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

  /** Simulated gate scan: `ok` matches the current slot, `bad` is a slot mismatch. */
  function simulateScan(result) {
    setScanResult(result);
    showToast(
      result === 'ok' ? '✅ Checked in — attendance registered' : '⛔ QR does not match this slot',
    );
  }

  const profileApi = useApi(() => getMyProfile(), []);
  const owner = profileApi.data;

  const { data: analyticsRes, loading } = useApi(getOwnerAnalytics, []);
  const analyticsData = analyticsRes?.data || analyticsRes || {};

  const KPIS = analyticsData.kpis || [];
  const NEXT_UP = analyticsData.nextUp || [];
  const ACTIVITY = analyticsData.activity || [];
  const ATTENTION = analyticsData.attention || [];

  return (
    <>
      <PageTitle title="Dashboard" />

      <div className="main-header">
        <div>
          <h1>Good evening, {owner?.name ?? 'Owner'} 🏟️</h1>
          <span className="subtle small">
            Kick Off Arena · Dhanmondi · <Badge tone="green">Live</Badge>
          </span>
        </div>
        <div className="row">
          <Button to={paths.owner.calendar}>🗓️ Calendar</Button>
          <Button to={paths.owner.calendar}>+ Manual booking</Button>
          <Button variant="primary" onClick={scanner.open}>
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
              Rafiul Karim · 10 players · Pitch 2 · 7:30–9:00 PM
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