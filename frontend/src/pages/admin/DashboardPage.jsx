import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Icon } from '@/components/common/Icon';
import { PageTitle } from '@/components/common/PageTitle';
import { CountUp } from '@/components/ui/CountUp';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { getPayoutSummary } from '@/api/payouts';
import { api, getUser } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { downloadCsv } from '@/utils/deviceActions';
import './DashboardPage.css';

const GRID_COLOR = 'rgba(255,255,255,0.06)';

const TIMEFRAMES = [
  { id: 'monthly', label: 'Monthly View' },
  { id: 'weekly', label: 'Weekly View' },
];

const YEARS = ['2026', '2025', '2024'];

const USER_SEGMENTS = [
  { id: 'all', label: 'All' },
  { id: 'players', label: 'Players' },
  { id: 'hosts', label: 'Hosts' },
];

// BREAKDOWN_LEGEND is now computed dynamically from live API data (see useMemo below)

// AUDIT_LOG is now fetched live from the backend (see useApi below)

const EARNINGS_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: GRID_COLOR },
      ticks: {
        callback: (value) =>
          value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${Math.round(value / 1000)}k`,
      },
    },
    x: { grid: { display: false } },
  },
};

const USER_GROWTH_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: { display: false, beginAtZero: true },
    x: { grid: { display: false } },
  },
};

// BREAKDOWN_DATA is now computed dynamically from live API data (see useMemo below)

const BREAKDOWN_OPTIONS = {
  cutout: '72%',
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
};

const formatBdtIn = (amount) => `৳${amount.toLocaleString('en-IN')}`;


export default function DashboardPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState('monthly');
  const [year, setYear] = useState('2026');
  const [userSegment, setUserSegment] = useState('all');

  const { data: revRes } = useApi(() => api(`/admin/analytics/revenue?year=${year}&timeframe=${timeframe}`), [year, timeframe]);
  const revenueDto = revRes?.data || revRes;
  const series = useMemo(
    () => revenueDto || { labels: [], gmv: [], bookings: [], totalGmv: 0, totalBookings: 0, growthPercent: '0%' },
    [revenueDto]
  );

  const earningsData = useMemo(
    () => ({
      labels: series.labels || [],
      datasets: [
        {
          label: 'GMV',
          data: series.gmv || [],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.22)',
          borderWidth: 3.5,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#22c55e',
          pointBorderWidth: 2.5,
        },
      ],
    }),
    [series],
  );

  // Totals only. Fetching every settled payout to add up one column pulled
  // 175 KB into the dashboard on each visit.
  const { data: payoutSummaryRes } = useApi(() => getPayoutSummary(), []);
  const payoutSummary = payoutSummaryRes?.data ?? payoutSummaryRes;

  const totals = useMemo(() => {
    const gmv = series.totalGmv || 0;
    const bookings = series.totalBookings || 0;
    // Only settled payouts count. Falling back to a percentage of GMV used to
    // display an invented figure as "disbursed payouts".
    const settledPayouts = Number(payoutSummary?.settledAmount) || 0;
    return {
      gmv,
      bookings,
      // Commission actually taken on settled payouts. This used to be a tenth
      // of GMV — neither the platform's real rate nor money anyone had received.
      fee: Number(payoutSummary?.platformFeeCollected) || 0,
      payouts: settledPayouts,
      aov: bookings > 0 ? Math.round(gmv / bookings) : 0,
      growth: series.growthPercent ?? '—'
    };
  }, [series, payoutSummary?.settledAmount, payoutSummary?.platformFeeCollected]);

  const { data: growthRes } = useApi(() => api('/admin/analytics/growth'), []);
  const growthDto = growthRes?.data || growthRes;

  const userGrowthData = useMemo(() => {
    const datasets = [];
    if (userSegment !== 'hosts') {
      datasets.push({
        label: 'Players',
        data: growthDto?.growthPlayers || [],
        backgroundColor: '#22c55e',
        barThickness: 14,
        borderRadius: { topLeft: 4, topRight: 4 },
      });
    }
    if (userSegment !== 'players') {
      datasets.push({
        label: 'Hosts',
        data: growthDto?.growthHosts || [],
        backgroundColor: '#3b82f6',
        barThickness: 14,
        borderRadius: { topLeft: 4, topRight: 4 },
      });
    }
    return { labels: growthDto?.growthMonths || [], datasets };
  }, [userSegment, growthDto]);

  const sessionUser = getUser();
  const userName = sessionUser?.fullName || 'Super Admin';

  const { data: statsRes, loading: statsLoading } = useApi(() => api('/admin/analytics/dashboard'));
  const stats = statsRes?.data || statsRes;

  // '—' while loading: the old `?? 0` fabricated zeros and CountUp animated
  // to them before the response landed.
  const pendingRequestsCount = statsLoading ? null : (stats?.pendingRequests ?? 0);
  const activeTurfsCount = statsLoading ? null : (stats?.activeTurfs ?? 0);
  const registeredUsersCount = statsLoading ? null : (stats?.registeredUsers ?? 0);
  const adminAccountsCount = statsLoading ? null : (stats?.adminAccounts ?? 0);

  // Live segments for breakdown card
  const { data: segRes } = useApi(() => api('/admin/analytics/segments'), []);
  const seg = segRes?.data || segRes;

  const breakdownLegend = useMemo(() => {
    if (!seg) return [];
    const total = seg.totalUsers || 1;
    const soloCount = Math.max(0, total - (seg.playerCount || 0) - (seg.hostCount || 0));
    return [
      { id: 'players', color: '#22c55e', name: 'Players', description: 'Regular turf bookers',
        count: (seg.playerCount || 0).toLocaleString('en-IN'),
        share: ((seg.playerCount || 0) / total * 100).toFixed(1) + '%', tone: 'green' },
      { id: 'hosts', color: '#3b82f6', name: 'Turf Hosts', description: 'Venue & pitch managers',
        count: (seg.hostCount || 0).toLocaleString('en-IN'),
        share: ((seg.hostCount || 0) / total * 100).toFixed(1) + '%', tone: 'blue' },
      { id: 'solo', color: '#a855f7', name: 'Solo Players', description: 'Looking for game (LFG)',
        count: soloCount.toLocaleString('en-IN'),
        share: (soloCount / total * 100).toFixed(1) + '%', tone: 'yellow' },
    ];
  }, [seg]);

  const breakdownData = useMemo(() => {
    if (!seg) return { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, spacing: 4 }] };
    const total = seg.totalUsers || 1;
    const soloCount = Math.max(0, total - (seg.playerCount || 0) - (seg.hostCount || 0));
    return {
      labels: ['Players', 'Turf Hosts', 'Solo Players'],
      datasets: [{
        data: [
          +((seg.playerCount || 0) / total * 100).toFixed(1),
          +((seg.hostCount || 0) / total * 100).toFixed(1),
          +(soloCount / total * 100).toFixed(1),
        ],
        backgroundColor: ['#22c55e', '#3b82f6', '#a855f7'],
        borderWidth: 0,
        spacing: 4,
      }],
    };
  }, [seg]);

  // Live audit log for Recent Activity card
  const { data: auditRes } = useApi(() => api('/admin/audit-log?page=0&size=5'), []);
  const rawAuditContent = useMemo(
    () => auditRes?.data?.content || auditRes?.content || [],
    [auditRes]
  );

  const auditLog = useMemo(() => rawAuditContent.map((entry) => {
    const when = entry.createdAt
      ? new Date(entry.createdAt).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
      : '';
    return {
      id: String(entry.id),
      tag: (entry.action || '').toUpperCase().replace(/\s+/g, '_'),
      tone: entry.actionTone || 'blue',
      title: `${entry.target ? entry.target + ' · ' : ''}${entry.action}`,
      detail: `${entry.details || ''} · By ${entry.adminName || 'System'}`,
      when,
    };
  }), [rawAuditContent]);

  return (
    <>
      <PageTitle title="Platform Overview" />

      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>Platform Overview</h1>
          <span className="subtle small">
            Welcome back, {userName} · {sessionUser?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Console
          </span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="glass-pill"
            type="button"
            onClick={() => {
              downloadCsv(
                `platform-overview-${year}-${timeframe}.csv`,
                ['Section', 'Metric', 'Value'],
                [
                  ['Totals', 'GMV', totals.gmv],
                  ['Totals', 'Bookings', totals.bookings],
                  ['Totals', 'Platform fee', totals.fee],
                  ['Totals', 'Payouts', totals.payouts],
                  ['Totals', 'Average order value', totals.aov],
                  ['Totals', 'Growth', totals.growth],
                  ['Platform', 'Pending requests', pendingRequestsCount],
                  ['Platform', 'Active turfs', activeTurfsCount],
                  ['Platform', 'Registered users', registeredUsersCount],
                  ['Platform', 'Admin accounts', adminAccountsCount],
                  ...(series.labels || []).map((label, index) => [
                    `GMV by ${timeframe}`,
                    label,
                    series.gmv?.[index] ?? '',
                  ]),
                  ...breakdownLegend.map((segment) => [
                    'User segments',
                    segment.name,
                    `${segment.count} (${segment.share})`,
                  ]),
                ],
              );
              showToast('Platform report downloaded \u2713');
            }}
          >
            <Icon name="download" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Grid (Liquid Glass) */}
      <div className="grid4" style={{ gap: 20, marginBottom: 28 }}>
        <div className="liquid-glass kpi-card">
          <div>
            <div className="between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                Pending Requests
              </span>
              <Icon name="file" style={{ color: 'var(--warn)' }} />
            </div>
            <b
              className="value num"
              style={{ color: 'var(--warn)', fontSize: 36, display: 'block', margin: '6px 0 2px' }}
            >
              {pendingRequestsCount == null ? '—' : <CountUp to={pendingRequestsCount} />}
            </b>
            <span className="delta nodot" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Awaiting verification
            </span>
          </div>
          <Link className="btn btn-sm btn-primary btn-link" to={paths.admin.turfRequests}>
            Review Requests →
          </Link>
        </div>

        <div className="liquid-glass kpi-card">
          <div>
            <div className="between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                Active Turfs
              </span>
              <Icon name="pin" style={{ color: 'var(--brand)' }} />
            </div>
            <b className="value num" style={{ fontSize: 36, display: 'block', margin: '6px 0 2px' }}>
              {activeTurfsCount == null ? '—' : <CountUp to={activeTurfsCount} delay={120} />}
            </b>
            <span className="delta" style={{ fontSize: 12 }}>
              Venues on platform
            </span>
          </div>
          <Link className="btn btn-sm btn-secondary btn-link" to={paths.admin.turfs}>
            Manage Turfs →
          </Link>
        </div>

        <div className="liquid-glass kpi-card">
          <div>
            <div className="between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                Registered Users
              </span>
              <Icon name="users" style={{ color: 'var(--info)' }} />
            </div>
            <b className="value num" style={{ fontSize: 36, display: 'block', margin: '6px 0 2px' }}>
              {registeredUsersCount == null ? '—' : <CountUp to={registeredUsersCount} delay={240} />}
            </b>
            <span className="delta" style={{ fontSize: 12 }}>
              Cumulative user base
            </span>
          </div>
          <Link className="btn btn-sm btn-secondary btn-link" to={paths.admin.users}>
            Manage Users →
          </Link>
        </div>

        <div className="liquid-glass kpi-card">
          <div>
            <div className="between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                Admin Accounts
              </span>
              <Icon name="shield" style={{ color: 'var(--mint)' }} />
            </div>
            <b className="value num" style={{ fontSize: 36, display: 'block', margin: '6px 0 2px' }}>
              {adminAccountsCount == null ? '—' : <CountUp to={adminAccountsCount} delay={360} />}
            </b>
            <span className="delta nodot" style={{ color: 'var(--mint)', fontSize: 12 }}>
              {sessionUser?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'} access
            </span>
          </div>
          <Link className="btn btn-sm btn-tertiary btn-link" to={paths.admin.admins}>
            Manage Admins →
          </Link>
        </div>
      </div>

      {/* SECTION 1: Earnings Analytics Visualizer (Apple Liquid Glass) */}
      <div className="liquid-glass" style={{ padding: 28, marginBottom: 28, borderRadius: 24 }}>
        <div
          className="between"
          style={{ marginBottom: 20, flexWrap: 'wrap', gap: 16, alignItems: 'center' }}
        >
          <div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <Icon name="money" style={{ color: 'var(--brand)', width: 22, height: 22 }} />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Platform Earnings &amp; Volume
              </h2>
            </div>
            <p className="subtle small" style={{ margin: '4px 0 0' }}>
              Platform transactions, commission collected, and payout activity
            </p>
          </div>

          <div className="row-wrap" style={{ gap: 12 }}>
            <div className="glass-pill-group">
              {TIMEFRAMES.map((item) => (
                <button
                  key={item.id}
                  className={item.id === timeframe ? 'glass-pill active' : 'glass-pill'}
                  type="button"
                  onClick={() => setTimeframe(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <select
              className="select-glass"
              aria-label="Year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {YEARS.map((value) => (
                <option key={value} value={value}>
                  Year: {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="earnings-grid">
          <div className="earnings-stats">
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <span
                className="subtle tiny"
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                TOTAL REVENUE (GMV)
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
                {formatBdtIn(totals.gmv)}
              </b>
              {/* The arrow used to be hardcoded up, so a decline still read as
                  growth. No data = an honest dash, not "+0.0% ▲". */}
              {totals.growth !== '—' ? (
                <span
                  className={`tiny delta ${String(totals.growth).trim().startsWith('-') ? 'down' : 'up'}`}
                  style={{ display: 'inline-block', marginTop: 4 }}
                >
                  {String(totals.growth).trim().startsWith('-') ? '▼' : '▲'} {totals.growth} vs prev period
                </span>
              ) : (
                <span className="tiny muted" style={{ display: 'inline-block', marginTop: 4 }}>
                  No comparison data for this period yet
                </span>
              )}
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <span
                className="subtle tiny"
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                NET PLATFORM COMMISSION
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
                {formatBdtIn(totals.fee)}
              </b>
              <span
                className="tiny subtle"
                style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
              >
                Commission collected on settled payouts
              </span>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <span
                className="subtle tiny"
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                COMPLETED BOOKINGS
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
                {totals.bookings.toLocaleString()}
              </b>
              <span
                className="tiny subtle"
                style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
              >
                Avg {formatBdtIn(totals.aov)} / booking
              </span>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <span
                className="subtle tiny"
                style={{
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                DISBURSED PAYOUTS
              </span>
              <b
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text)',
                  lineHeight: 1.2,
                  display: 'block',
                }}
              >
                {formatBdtIn(totals.payouts)}
              </b>
              <span
                className="tiny subtle"
                style={{ display: 'inline-block', marginTop: 4, color: 'var(--text-3)' }}
              >
                Settled via the payouts console
              </span>
            </div>
          </div>

          <ChartCanvas
            type="line"
            data={earningsData}
            options={EARNINGS_OPTIONS}
            height={340}
            label="Platform earnings and booking volume"
          />
        </div>
      </div>

      {/* SECTION 2: User Base Analytics Visualizer (Apple Liquid Glass) */}
      <div className="grid2" style={{ gap: 24, marginBottom: 28 }}>
        <div
          className="liquid-glass"
          style={{ padding: 24, borderRadius: 24, cursor: 'pointer' }}
          role="link"
          tabIndex={0}
          onClick={() => navigate(paths.admin.userGrowth)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate(paths.admin.userGrowth);
          }}
        >
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="users" style={{ color: 'var(--info)' }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  User Growth &amp; Acquisition
                </h3>
              </div>
              <span className="subtle small">Monthly new user registrations vs active users</span>
            </div>
            {/* Pills own their clicks so the card link does not fire. */}
            <div className="glass-pill-group" onClick={(event) => event.stopPropagation()}>
              {USER_SEGMENTS.map((item) => (
                <button
                  key={item.id}
                  className={item.id === userSegment ? 'glass-pill active' : 'glass-pill'}
                  type="button"
                  onClick={() => setUserSegment(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row admin-wrap-mobile" style={{ gap: 16, marginBottom: 14 }}>
            <div>
              <span className="tiny subtle">Total User Base</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800 }}>
                {growthDto ? (growthDto.totalUsers || 0).toLocaleString('en-IN') : '—'}
              </b>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-soft)', paddingLeft: 16 }}>
              <span className="tiny subtle">Active Ratio</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800, color: 'var(--mint)' }}>
                {growthDto ? (growthDto.activeRatio || 0).toFixed(1) + '%' : '—'}
              </b>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-soft)', paddingLeft: 16 }}>
              <span className="tiny subtle">New Today</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800, color: 'var(--brand-600)' }}>
                +{growthDto ? (growthDto.newUsersToday || 0) : '—'}
              </b>
            </div>
          </div>

          <ChartCanvas
            type="bar"
            data={userGrowthData}
            options={USER_GROWTH_OPTIONS}
            height={230}
            label="New player and host registrations by month"
          />
        </div>

        <div
          className="liquid-glass"
          style={{ padding: 24, borderRadius: 24, cursor: 'pointer' }}
          role="link"
          tabIndex={0}
          onClick={() => navigate(paths.admin.userSegments)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate(paths.admin.userSegments);
          }}
        >
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="spinner" style={{ color: 'var(--mint)' }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>User Segment Breakdown</h3>
              </div>
              <span className="subtle small">Distribution across player roles &amp; venue partners</span>
            </div>
            <span className="badge green nodot">{seg ? (seg.totalUsers || 0).toLocaleString('en-IN') : '—'} Total</span>
          </div>

          <div
            className="admin-stack-mobile"
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 20,
              alignItems: 'center',
              minHeight: 230,
            }}
          >
            <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto' }}>
              <ChartCanvas
                type="doughnut"
                data={breakdownData}
                options={BREAKDOWN_OPTIONS}
                height={170}
                label="User distribution across players, hosts and solo players"
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 800, display: 'block', lineHeight: 1 }}>
                  {/* Same guard as UserSegmentsPage: 412 users must not read as "0.4K". */}
                  {seg ? (seg.totalUsers >= 1000 ? `${(seg.totalUsers / 1000).toFixed(1)}K` : String(seg.totalUsers ?? 0)) : '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>USERS</span>
              </div>
            </div>

            <div className="user-breakdown-legend">
              {breakdownLegend.map((item) => (
                <div className="legend-item" key={item.id}>
                  <div>
                    <span className="legend-dot" style={{ background: item.color }} />
                    <b style={{ fontSize: 14 }}>{item.name}</b>
                    <span className="tiny subtle" style={{ display: 'block' }}>
                      {item.description}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: 15, display: 'block' }}>{item.count}</b>
                    <span className={`tiny badge ${item.tone} nodot`}>{item.share}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: System Audit Log & SLA Risk Panel */}
      <div className="liquid-glass" style={{ borderRadius: 24, padding: '24px 28px' }}>
        <div className="between" style={{ marginBottom: 18, alignItems: 'center' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Icon name="activity" style={{ color: 'var(--brand)', width: 20, height: 20 }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Recent Platform Audit Log</h3>
            <span className="subtle small" style={{ marginLeft: 8 }}>
              {stats?.pendingRequests ?? 0} Pending · {activeTurfsCount} Venues Live
            </span>
          </div>
          <Link className="btn btn-sm btn-tertiary" to={paths.admin.activity} style={{ fontWeight: 700 }}>
            View Full System Log →
          </Link>
        </div>

        <div className="stack-sm" style={{ gap: 10 }}>
          {auditLog.length === 0 && (
            <span className="tiny subtle" style={{ padding: '10px 0', display: 'block' }}>No activity yet.</span>
          )}
          {auditLog.map((entry) => (
            <div
              className="history-item between"
              key={entry.id}
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-soft)',
                alignItems: 'center',
              }}
            >
              <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                <span
                  className={`badge ${entry.tone} nodot`}
                  style={{ fontSize: 11, padding: '4px 10px', minWidth: 110, textAlign: 'center' }}
                >
                  {entry.tag}
                </span>
                <div>
                  <b
                    className="small"
                    style={{ display: 'block', color: 'var(--text-1)', fontWeight: 700 }}
                  >
                    {entry.title}
                  </b>
                  <span className="tiny muted">{entry.detail}</span>
                </div>
              </div>
              <span className="tiny subtle">{entry.when}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
