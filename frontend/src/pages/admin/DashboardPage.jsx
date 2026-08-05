import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Icon } from '@/components/common/Icon';
import { PageTitle } from '@/components/common/PageTitle';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './DashboardPage.css';

const GRID_COLOR = 'rgba(255,255,255,0.06)';

/** GMV / booking series keyed by timeframe then by year, as in the prototype. */
const EARNINGS_DATA = {
  monthly: {
    2026: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
      gmv: [3820000, 4150000, 4400000, 4780000, 5100000, 5350000, 5600000, 5920000],
      bookings: [14200, 15400, 16100, 17500, 18900, 19800, 20700, 21900],
      growth: '+24.6%',
    },
    2025: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      gmv: [2400000, 2650000, 2900000, 3100000, 3350000, 3500000, 3680000, 3800000, 3950000, 4100000, 4300000, 4600000],
      bookings: [9100, 10200, 11000, 11800, 12600, 13100, 13800, 14200, 14900, 15500, 16300, 17400],
      growth: '+31.2%',
    },
    2024: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      gmv: [1200000, 1350000, 1500000, 1650000, 1800000, 1950000, 2100000, 2200000, 2300000, 2450000, 2600000, 2800000],
      bookings: [4500, 5100, 5700, 6300, 6900, 7400, 8000, 8400, 8800, 9300, 9900, 10600],
      growth: '+45.0%',
    },
  },
  weekly: {
    2026: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      gmv: [680000, 720000, 790000, 840000, 1150000, 1420000, 1320000],
      bookings: [2500, 2700, 2950, 3100, 4300, 5400, 4900],
      growth: '+18.2%',
    },
    2025: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      gmv: [480000, 520000, 590000, 640000, 850000, 1020000, 950000],
      bookings: [1800, 1950, 2200, 2400, 3200, 3900, 3600],
      growth: '+14.5%',
    },
    2024: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      gmv: [280000, 310000, 340000, 380000, 510000, 650000, 600000],
      bookings: [1100, 1200, 1300, 1450, 1900, 2400, 2250],
      growth: '+22.0%',
    },
  },
};

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

const GROWTH_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const GROWTH_PLAYERS = [2400, 2900, 3400, 3900, 4200, 4800];
const GROWTH_HOSTS = [320, 410, 490, 560, 620, 710];

const BREAKDOWN_LEGEND = [
  {
    id: 'players',
    color: '#22c55e',
    name: 'Players',
    description: 'Regular turf bookers',
    count: '34,200',
    share: '82.9%',
    tone: 'green',
  },
  {
    id: 'hosts',
    color: '#3b82f6',
    name: 'Turf Hosts',
    description: 'Venue & pitch managers',
    count: '4,850',
    share: '11.8%',
    tone: 'blue',
  },
  {
    id: 'solo',
    color: '#a855f7',
    name: 'Solo Players',
    description: 'Looking for game (LFG)',
    count: '2,220',
    share: '5.3%',
    tone: 'yellow',
  },
];

const AUDIT_LOG = [
  {
    id: 'tr-1039',
    tag: 'APPROVAL',
    tone: 'blue',
    title: 'TR-1039 · GreenTurf Annex Approved',
    detail: 'Verified venue ownership documents · By Farid Hasan',
    when: 'Today 6:24 PM',
  },
  {
    id: 'p-38112',
    tag: 'MODERATION',
    tone: 'red',
    title: 'Player #38112 Suspended (No-Show Repeat)',
    detail: 'Automated temporary ban policy applied · By Nadia Amin',
    when: 'Today 4:02 PM',
  },
  {
    id: 'v-0077',
    tag: 'AUTOMATION',
    tone: 'yellow',
    title: 'Venue #77 Payout Flagged for Review',
    detail: 'Refund ratio spike detected (> 4.2% threshold)',
    when: 'Today 11:30 AM',
  },
];

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
    y: { display: false, beginAtZero: true, max: 5500 },
    x: { grid: { display: false } },
  },
};

const BREAKDOWN_DATA = {
  labels: ['Players', 'Turf Hosts', 'Solo Players'],
  datasets: [
    {
      data: [82.9, 11.8, 5.3],
      backgroundColor: ['#22c55e', '#3b82f6', '#a855f7'],
      borderWidth: 0,
      spacing: 4,
    },
  ],
};

const BREAKDOWN_OPTIONS = {
  cutout: '72%',
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
};

const formatBdtIn = (amount) => `৳${amount.toLocaleString('en-IN')}`;
const sum = (values) => values.reduce((total, value) => total + value, 0);

export default function DashboardPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState('monthly');
  const [year, setYear] = useState('2026');
  const [userSegment, setUserSegment] = useState('all');

  const series = EARNINGS_DATA[timeframe][year];

  const earningsData = useMemo(
    () => ({
      labels: series.labels,
      datasets: [
        {
          label: 'GMV',
          data: series.gmv,
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

  const totals = useMemo(() => {
    const gmv = sum(series.gmv);
    const bookings = sum(series.bookings);
    return {
      gmv,
      bookings,
      fee: Math.round(gmv * 0.1),
      payouts: Math.round(gmv * 0.9),
      aov: Math.round(gmv / bookings),
    };
  }, [series]);

  const userGrowthData = useMemo(() => {
    const datasets = [];
    if (userSegment !== 'hosts') {
      datasets.push({
        label: 'Players',
        data: GROWTH_PLAYERS,
        backgroundColor: '#22c55e',
        barThickness: 14,
        borderRadius: { topLeft: 4, topRight: 4 },
      });
    }
    if (userSegment !== 'players') {
      datasets.push({
        label: 'Hosts',
        data: GROWTH_HOSTS,
        backgroundColor: '#3b82f6',
        barThickness: 14,
        borderRadius: { topLeft: 4, topRight: 4 },
      });
    }
    return { labels: GROWTH_MONTHS, datasets };
  }, [userSegment]);

  return (
    <>
      <PageTitle title="Platform Overview" />

      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            Platform Overview
          </h1>
          <span className="subtle small">Welcome back, Nadia Amin · Super Admin Executive Console</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="glass-pill"
            type="button"
            onClick={() => showToast('Executive PDF Report exported 📊')}
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
              4
            </b>
            <span className="delta down" style={{ fontSize: 12 }}>
              Oldest request: 3 days ago
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
              128
            </b>
            <span className="delta up" style={{ fontSize: 12 }}>
              ▲ 6 venues added this month
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
              41,270
            </b>
            <span className="delta up" style={{ fontSize: 12 }}>
              ▲ 1,140 registered this week
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
              5
            </b>
            <span className="delta nodot" style={{ color: 'var(--mint)', fontSize: 12 }}>
              Super Admin privileges active
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
              Real-time tracking of platform transactions, take-rate commission, and payout activity
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
              <span className="tiny delta up" style={{ display: 'inline-block', marginTop: 4 }}>
                ▲ {series.growth} vs prev period
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
                10% Take-Rate Commission
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
                Automated bKash &amp; Nagad
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

          <div className="row" style={{ gap: 16, marginBottom: 14 }}>
            <div>
              <span className="tiny subtle">Total User Base</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800 }}>41,270</b>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-soft)', paddingLeft: 16 }}>
              <span className="tiny subtle">Active Ratio</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800, color: 'var(--mint)' }}>
                89.4%
              </b>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-soft)', paddingLeft: 16 }}>
              <span className="tiny subtle">Monthly Growth</span>
              <b style={{ display: 'block', fontSize: 22, fontWeight: 800, color: 'var(--brand-600)' }}>
                +14.8%
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
            <span className="badge green nodot">41,270 Verified</span>
          </div>

          <div
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
                data={BREAKDOWN_DATA}
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
                  41.2K
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>USERS</span>
              </div>
            </div>

            <div className="user-breakdown-legend">
              {BREAKDOWN_LEGEND.map((item) => (
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
              1,862 Bookings Today · GMV ৳38.4L
            </span>
          </div>
          <Link className="btn btn-sm btn-tertiary" to={paths.admin.activity} style={{ fontWeight: 700 }}>
            View Full System Log →
          </Link>
        </div>

        <div className="stack-sm" style={{ gap: 10 }}>
          {AUDIT_LOG.map((entry) => (
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
