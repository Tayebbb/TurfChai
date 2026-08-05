import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { KpiCard } from '@/components/cards/KpiCard';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { Progress } from '@/components/ui/Progress';
import { currentOwner } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useState } from 'react';
import './DashboardPage.css';

const KPIS = [
  { label: "Today's revenue", value: '৳18,400', delta: '▲ 12% vs last Fri', trend: 'up' },
  { label: 'Bookings today', value: '14', delta: '▲ 2 more than avg', trend: 'up' },
  { label: 'Occupancy', value: '72%', delta: 'Peak 4–11 PM: 94%' },
  { label: 'Pending payments', value: '৳4,300', delta: '3 bookings awaiting', trend: 'down' },
];

const NEXT_UP = [
  {
    id: 'p2-730',
    slot: '7:30 PM · Pitch 2',
    badge: { tone: 'green', text: 'Online · paid' },
    detail: 'Rafiul Karim · 10 players · TC-48291 · handover 7:20',
    action: { kind: 'link', to: paths.owner.bookings, label: 'Detail', variant: 'secondary' },
  },
  {
    id: 'p1-730',
    slot: '7:30 PM · Pitch 1',
    badge: { tone: 'amber', text: 'Phone · deposit' },
    detail: 'Karim Traders XI · ৳765 paid · ৳1,785 due',
    action: { kind: 'toast', toast: 'Marked as arrived ✓', label: 'Arrived', variant: 'secondary' },
  },
  {
    id: 'p2-900',
    slot: '9:00 PM · Pitch 2',
    badge: { tone: 'blue', text: 'Open game' },
    detail: 'Friday Night Football · host Rifat H. · 10/10 paid',
    action: { kind: 'link', to: paths.owner.bookings, label: 'Detail', variant: 'secondary' },
  },
  {
    id: 'p3-900',
    slot: '9:00 PM · Pitch 3',
    badge: { tone: 'gray', text: 'Empty' },
    detail: 'Futsal court unbooked tonight',
    action: { kind: 'link', to: paths.owner.promotions, label: 'Promote', variant: 'primary' },
  },
];

const ACTIVITY = [
  {
    id: 'bkash',
    title: 'bKash payment reconciled — ৳2,550',
    detail: 'TC-48291 · Rafiul K. · auto-matched to evening shift · 6:12 PM',
  },
  {
    id: 'open-game',
    title: 'Open game filled 10/10',
    detail: 'Friday Night Football · last share ৳280 paid · 5:47 PM',
  },
  {
    id: 'walk-in',
    title: 'Walk-in cash booking — ৳1,700',
    detail: 'Pitch 3 · added by staff Sumon · afternoon shift · 3:05 PM',
  },
  {
    id: 'refund',
    title: 'Refund issued — ৳2,200',
    detail: 'TC-48102 cancelled 26h ahead · full refund per policy · 11:40 AM',
  },
];

const ATTENTION = [
  {
    id: 'deposits',
    tone: 'warn',
    icon: '💰',
    title: '3 deposit bookings due tonight',
    body: '৳4,300 to collect at venue. ',
    link: { to: paths.owner.bookings, label: 'View list' },
  },
  {
    id: 'reviews',
    tone: 'info',
    icon: '⭐',
    title: '2 new reviews await response',
    body: 'Replying raises repeat bookings. ',
    link: { to: paths.owner.reviews, label: 'Respond' },
  },
  {
    id: 'offpeak',
    tone: 'info',
    icon: '📉',
    title: 'Tue–Wed 2–4 PM off-peak low',
    body: 'Try an off-peak promo. ',
    link: { to: paths.owner.promotions, label: 'Create' },
  },
];

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

  return (
    <>
      <PageTitle title="Dashboard" />

      <div className="main-header">
        <div>
          <h1>Good evening, {currentOwner.shortName} 🏟️</h1>
          <span className="subtle small">
            {currentOwner.venue} · {currentOwner.area} · <Badge tone="green">Live</Badge>
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