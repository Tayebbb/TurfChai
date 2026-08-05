import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { PageTitle } from '@/components/common/PageTitle';
import { paths } from '@/routes/paths';
import './UserGrowthPage.css';

const KPIS = [
  {
    id: 'total',
    label: 'TOTAL REGISTERED',
    value: '41,270',
    valueColor: undefined,
    note: 'Cumulative users',
  },
  {
    id: 'new',
    label: 'NEW REGISTRATIONS',
    value: '+248 Today',
    valueColor: 'var(--brand-600)',
    note: 'Daily growth velocity',
  },
  {
    id: 'active',
    label: 'ACTIVE RATIO',
    value: '89.4%',
    valueColor: 'var(--mint)',
    note: '36,890 active MAU',
  },
  {
    id: 'retention',
    label: 'RETENTION RATE',
    value: '84.2%',
    valueColor: 'var(--info)',
    note: '30-day user return',
  },
];

const SIGNUP_DATA = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      data: [142, 178, 165, 192, 214, 258, 248],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.35)',
      borderWidth: 3.5,
      tension: 0.4,
      fill: true,
      pointRadius: 4.5,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#3b82f6',
      pointBorderWidth: 2.5,
    },
  ],
};

const SIGNUP_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
    x: { grid: { display: false } },
  },
};

const CHANNELS = [
  { id: 'organic', channel: 'Organic Search', users: '12,450', conversion: '4.8%', cac: '৳0' },
  { id: 'appstore', channel: 'App Store Referral', users: '10,820', conversion: '6.2%', cac: '৳12' },
  { id: 'meta', channel: 'Meta/Facebook Ads', users: '9,240', conversion: '2.9%', cac: '৳85' },
  { id: 'tiktok', channel: 'TikTok campaigns', users: '5,410', conversion: '3.4%', cac: '৳60' },
  { id: 'invites', channel: 'Direct Invites', users: '3,350', conversion: '8.5%', cac: '৳5' },
];

const SIGNUP_STREAM = [
  {
    id: 'U-88902',
    name: 'Riazul Islam',
    role: 'Player',
    roleTone: 'green',
    area: 'Dhanmondi',
    referral: 'Meta Ads',
    joined: '2 mins ago',
  },
  {
    id: 'U-88901',
    name: 'Asif Abdullah',
    role: 'Player',
    roleTone: 'green',
    area: 'Mohammadpur',
    referral: 'Organic Search',
    joined: '14 mins ago',
  },
  {
    id: 'U-88898',
    name: 'Sheikh Turf Arena',
    role: 'Host',
    roleTone: 'blue',
    area: 'Mirpur 11',
    referral: 'Direct Referral',
    joined: '38 mins ago',
  },
  {
    id: 'U-88897',
    name: 'Zamil Rahman',
    role: 'Player',
    roleTone: 'green',
    area: 'Uttara',
    referral: 'Direct Invite',
    joined: '1 hour ago',
  },
  {
    id: 'U-88894',
    name: 'Tamim Anwar',
    role: 'Player',
    roleTone: 'green',
    area: 'Khilgaon',
    referral: 'TikTok Campaign',
    joined: '2 hours ago',
  },
];

const BARE_TABLE_WRAP = {
  padding: 0,
  borderRadius: 12,
  background: 'transparent',
  border: 0,
  boxShadow: 'none',
};

export default function UserGrowthPage() {
  return (
    <>
      <PageTitle title="User Growth & Acquisition" />

      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Link
              className="btn btn-sm btn-tertiary"
              to={paths.admin.dashboard}
              style={{ padding: '4px 10px', fontWeight: 700 }}
            >
              ← Back
            </Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              User Growth &amp; Acquisition
            </h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Detailed metrics for signup growth and acquisition channels
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {KPIS.map((kpi) => (
          <div className="stat-card-simple" key={kpi.id}>
            <span
              className="subtle tiny"
              style={{ fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-3)' }}
            >
              {kpi.label}
            </span>
            <b
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                display: 'block',
                marginTop: 4,
                color: kpi.valueColor,
              }}
            >
              {kpi.value}
            </b>
            <span className="tiny subtle" style={{ color: 'var(--text-3)' }}>
              {kpi.note}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 28,
        }}
      >
        {/* Visual Acquisition Chart Card */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Signup Growth Curve</h3>
              <span className="subtle small">
                Daily registration registrations over past week
              </span>
            </div>
            <span className="badge blue nodot">Live Analytics</span>
          </div>
          <ChartCanvas
            type="line"
            data={SIGNUP_DATA}
            options={SIGNUP_OPTIONS}
            height={230}
            label="Daily signup growth over the past week"
          />
        </div>

        {/* Acquisition Channels Table */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>
            Acquisition Channels breakdown
          </h3>
          <div className="table-wrap" style={BARE_TABLE_WRAP}>
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">New Users</th>
                  <th className="num">Conv. Rate</th>
                  <th className="num">CAC</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.channel}</b>
                    </td>
                    <td className="num font-semibold">{row.users}</td>
                    <td className="num font-semibold">{row.conversion}</td>
                    <td className="num font-semibold">{row.cac}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent User Signups Log */}
      <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>
          Real-Time Registration Stream
        </h3>
        <div className="table-wrap" style={BARE_TABLE_WRAP}>
          <table className="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Area</th>
                <th>Referral Method</th>
                <th style={{ textAlign: 'right' }}>Time Joined</th>
              </tr>
            </thead>
            <tbody>
              {SIGNUP_STREAM.map((row) => (
                <tr key={row.id}>
                  <td className="num">
                    <b>{row.id}</b>
                  </td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`badge ${row.roleTone} nodot`}>{row.role}</span>
                  </td>
                  <td>{row.area}</td>
                  <td>{row.referral}</td>
                  <td style={{ textAlign: 'right' }} className="num">
                    {row.joined}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
