import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { findVenue } from '@/data/admin';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './TurfDetailsPage.css';

const DEMAND_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEMAND_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
    x: { grid: { display: false } },
  },
};

const SUSPEND_REASONS = [
  'Host payout anomaly flagged',
  'Multiple user reports of poor court state',
  'Failure to renew compliance/trade license',
  'Policy violation',
];

/** Mirrors the prototype's `setDocStatus` badge-tone mapping. */
function docTone(value) {
  if (value.includes('Verified')) return 'green';
  if (value.includes('Pending') || value.includes('Anomaly')) return 'amber';
  return 'red';
}

export default function TurfDetailsPage() {
  const { turfId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const suspend = useDisclosure(false);
  const reinstate = useDisclosure(false);
  const [suspendReason, setSuspendReason] = useState(SUSPEND_REASONS[0]);
  const [suspendNote, setSuspendNote] = useState('');

  const venue = findVenue(turfId);

  const demandData = useMemo(
    () => ({
      labels: DEMAND_LABELS,
      datasets: [
        {
          label: 'Bookings',
          data: venue.chartData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.35)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
        },
      ],
    }),
    [venue.chartData],
  );

  const isSuspended = venue.status.includes('Suspended');
  const isPending = venue.status.includes('Pending');

  const deleteVenue = () => {
    showToast('Venue successfully deleted from platform database.');
    navigate(paths.admin.turfs);
  };

  const confirmSuspend = () => {
    suspend.close();
    showToast('Venue suspended and status updated to audit trail ✓');
  };

  const confirmReinstate = () => {
    reinstate.close();
    showToast('Venue reinstated successfully! Live status restored ✓');
  };

  return (
    <>
      <PageTitle title="Turf Details & Analytics" />

      {/* Page Header */}
      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Link
              className="btn btn-sm btn-tertiary"
              to={paths.admin.turfs}
              style={{ padding: '4px 10px', fontWeight: 700 }}
            >
              ← Back to List
            </Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              {venue.name} ({venue.id})
            </h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            {venue.area} · Registered on {venue.dateAdded}
          </span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {isSuspended ? (
            <>
              <button className="btn btn-secondary" type="button" onClick={reinstate.open}>
                Reinstate Venue
              </button>
              <button className="btn btn-ghost-danger" type="button" onClick={deleteVenue}>
                Delete Venue
              </button>
            </>
          ) : null}
          {!isSuspended && isPending ? (
            <>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => showToast('Venue approved! Now active on search index ✓')}
              >
                Approve &amp; Make Live
              </button>
              <button className="btn btn-ghost-danger" type="button" onClick={deleteVenue}>
                Reject listing
              </button>
            </>
          ) : null}
          {!isSuspended && !isPending ? (
            <>
              <button className="btn btn-secondary" type="button" onClick={suspend.open}>
                Suspend Venue
              </button>
              <button className="btn btn-ghost-danger" type="button" onClick={deleteVenue}>
                Delete Venue
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Row 1: KPI Cards + Interactive Analytics Chart */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 28,
          marginBottom: 28,
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}
        >
          <div className="stat-card-simple">
            <span
              className="subtle tiny"
              style={{
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 2,
              }}
            >
              30-DAY REVENUE
            </span>
            <b
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--brand-600)',
                lineHeight: 1.2,
                display: 'block',
              }}
            >
              {venue.revenue30d}
            </b>
            <span
              className="tiny subtle"
              style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
            >
              Gross booking fees
            </span>
          </div>

          <div className="stat-card-simple">
            <span
              className="subtle tiny"
              style={{
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 2,
              }}
            >
              PITCH OCCUPANCY
            </span>
            <b
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--mint)',
                lineHeight: 1.2,
                display: 'block',
              }}
            >
              {venue.occupancy}
            </b>
            <span
              className="tiny subtle"
              style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
            >
              Slot utilization ratio
            </span>
          </div>

          <div className="stat-card-simple">
            <span
              className="subtle tiny"
              style={{
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 2,
              }}
            >
              30-DAY BOOKINGS
            </span>
            <b
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--info)',
                lineHeight: 1.2,
                display: 'block',
              }}
            >
              {venue.bookings30d.toLocaleString()}
            </b>
            <span
              className="tiny subtle"
              style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
            >
              Completed games
            </span>
          </div>

          <div className="stat-card-simple">
            <span
              className="subtle tiny"
              style={{
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 2,
              }}
            >
              AVERAGE RATING
            </span>
            <b
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: 'var(--warn)',
                lineHeight: 1.2,
                display: 'block',
              }}
            >
              {venue.rating}
            </b>
            <span
              className="tiny subtle"
              style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
            >
              Player reviews
            </span>
          </div>
        </div>

        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Booking Demand Trend</h3>
              <span className="subtle small">Daily slot booking counts over the past week</span>
            </div>
            <span className="badge blue nodot">Active Analytics</span>
          </div>
          <ChartCanvas
            type="line"
            data={demandData}
            options={DEMAND_OPTIONS}
            height={250}
            label="Daily slot booking counts over the past week"
          />
        </div>
      </div>

      {/* Row 2: Info details columns */}
      <div className="details-grid">
        {/* Left Column: Profile & Documents */}
        <div
          className="liquid-glass"
          style={{
            padding: 24,
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
              Owner Profile &amp; Contact
            </h3>
            <div className="stack-sm" style={{ gap: 10 }}>
              <div className="between">
                <span className="subtle small">Owner Name</span>
                <b style={{ color: 'var(--text)' }}>{venue.owner}</b>
              </div>
              <div className="between">
                <span className="subtle small">Phone Number</span>
                <span className="num font-semibold">{venue.phone}</span>
              </div>
              <div className="between">
                <span className="subtle small">Email Address</span>
                <span className="font-semibold">{venue.email}</span>
              </div>
              <div className="between">
                <span className="subtle small">Registration Area</span>
                <b>{venue.area}</b>
              </div>
              <div className="between">
                <span className="subtle small">Date Joined</span>
                <span className="num subtle">{venue.dateAdded}</span>
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />

          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
              Compliance &amp; Verification
            </h3>
            <div className="doc-row">
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>Trade License</b>
                <span className="subtle tiny">Issued by City Corporation</span>
              </div>
              <span className={`badge ${docTone(venue.documents.tradeLicense)}`}>
                {venue.documents.tradeLicense}
              </span>
            </div>
            <div className="doc-row">
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>Owner NID / Passport</b>
                <span className="subtle tiny">National ID biometric check</span>
              </div>
              <span className={`badge ${docTone(venue.documents.ownerNid)}`}>
                {venue.documents.ownerNid}
              </span>
            </div>
            <div className="doc-row">
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>Commercial Utility Bill</b>
                <span className="subtle tiny">Electricity/gas venue proof</span>
              </div>
              <span className={`badge ${docTone(venue.documents.utilityBill)}`}>
                {venue.documents.utilityBill}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Pitches configuration */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
            Court Configurations ({venue.pitches} Pitches)
          </h3>
          <div
            className="table-wrap"
            style={{
              padding: 0,
              borderRadius: 12,
              background: 'transparent',
              border: 0,
              boxShadow: 'none',
            }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th>Pitch Name</th>
                  <th>Surface Type</th>
                  <th style={{ textAlign: 'right' }}>Hourly Rate</th>
                </tr>
              </thead>
              <tbody>
                {venue.pitchesList.map((pitch) => (
                  <tr key={pitch.name}>
                    <td>
                      <b>{pitch.name}</b>
                    </td>
                    <td>
                      <span className="badge gray nodot">{pitch.type}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="num font-semibold">
                      {pitch.rate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Bookings Log */}
      <div className="liquid-glass" style={{ padding: 24, borderRadius: 20, marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>Recent Booking Log</h3>
        <div
          className="table-wrap"
          style={{
            padding: 0,
            borderRadius: 12,
            background: 'transparent',
            border: 0,
            boxShadow: 'none',
          }}
        >
          <table className="table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Date &amp; Time</th>
                <th>Player / Customer</th>
                <th>Pitch Booked</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {venue.recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="center subtle small" style={{ padding: '24px 0' }}>
                    No recent bookings logged for this venue.
                  </td>
                </tr>
              ) : (
                venue.recentBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="num">
                      <b>{booking.id}</b>
                    </td>
                    <td className="num">{booking.time}</td>
                    <td>{booking.player}</td>
                    <td>{booking.pitch}</td>
                    <td className="num font-semibold">{booking.amount}</td>
                    <td>
                      <span
                        className={`badge ${booking.status.includes('Completed') ? 'green' : 'red'}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Modal */}
      <Overlay
        isOpen={suspend.isOpen}
        onClose={suspend.close}
        title="Suspend Turf Listing?"
        hideHeader
      >
        <div className="fail-anim" aria-hidden="true">
          !
        </div>
        <h3 className="center" style={{ marginBottom: 8 }}>
          Suspend Turf Listing?
        </h3>
        <p className="muted small center" style={{ marginBottom: 12 }}>
          This will freeze slot listings, reject immediate bookings, and pause payouts.
        </p>
        <div className="field">
          <label htmlFor="suspendReason">Suspension Reason</label>
          <select
            className="select"
            id="suspendReason"
            value={suspendReason}
            onChange={(event) => setSuspendReason(event.target.value)}
          >
            {SUSPEND_REASONS.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="suspendNote">Additional Context Note</label>
          <input
            className="input"
            id="suspendNote"
            placeholder="e.g. Refund spike detected over 24 hours"
            value={suspendNote}
            onChange={(event) => setSuspendNote(event.target.value)}
          />
        </div>
        <div className="stack-sm" style={{ marginTop: 14 }}>
          <button className="btn btn-danger btn-block" type="button" onClick={confirmSuspend}>
            Suspend Venue
          </button>
          <button className="btn btn-tertiary btn-block" type="button" onClick={suspend.close}>
            Cancel
          </button>
        </div>
      </Overlay>

      {/* Reinstate Modal */}
      <Overlay
        isOpen={reinstate.isOpen}
        onClose={reinstate.close}
        title="Reinstate Turf Venue?"
        hideHeader
      >
        <div className="check-anim" style={{ background: 'var(--brand)' }} aria-hidden="true">
          ✓
        </div>
        <h3 className="center" style={{ marginBottom: 8 }}>
          Reinstate Turf Venue?
        </h3>
        <p className="muted small center" style={{ marginBottom: 16 }}>
          This will restore the venue to Live status, allowing users to discover and book pitches
          immediately.
        </p>
        <div className="stack-sm">
          <button className="btn btn-primary btn-block" type="button" onClick={confirmReinstate}>
            Confirm Reinstatement
          </button>
          <button className="btn btn-tertiary btn-block" type="button" onClick={reinstate.close}>
            Cancel
          </button>
        </div>
      </Overlay>
    </>
  );
}
