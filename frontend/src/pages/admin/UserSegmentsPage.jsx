import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Icon } from '@/components/common/Icon';
import { PageTitle } from '@/components/common/PageTitle';
import { paths } from '@/routes/paths';

const KPIS = [
  {
    id: 'players',
    label: 'Active Players',
    icon: 'users',
    color: 'var(--brand)',
    value: '34,200',
    deltaClass: 'delta up',
    deltaStyle: { fontSize: 12 },
    deltaText: 'Regular turf bookers',
  },
  {
    id: 'hosts',
    label: 'Verified Hosts',
    icon: 'pin',
    color: 'var(--info)',
    value: '1,280',
    deltaClass: 'delta nodot',
    deltaStyle: { color: 'var(--info)', fontSize: 12 },
    deltaText: 'Registered venue partners',
  },
  {
    id: 'inactive',
    label: 'Inactive Accounts',
    icon: 'alert',
    color: 'var(--warn)',
    value: '5,790',
    deltaClass: 'delta down',
    deltaStyle: { fontSize: 12 },
    deltaText: 'No activity in 30 days',
  },
  {
    id: 'ltv',
    label: 'Avg Lifetime Value',
    icon: 'money',
    color: 'var(--brand-600)',
    value: '৳4,250',
    deltaClass: 'delta nodot',
    deltaStyle: { color: 'var(--text-3)', fontSize: 12 },
    deltaText: 'Per registered cohort',
  },
];

const DONUT_DATA = {
  labels: ['Players', 'Hosts', 'Inactive'],
  datasets: [
    {
      data: [83, 3, 14],
      backgroundColor: ['#22C55E', '#60A5FA', '#FBBF24'],
      borderWidth: 0,
      spacing: 4,
    },
  ],
};

const DONUT_OPTIONS = {
  cutout: '71%',
  plugins: { legend: { display: false } },
};

const SHARE_LEGEND = [
  {
    id: 'players',
    dot: 'var(--brand)',
    name: 'Players',
    note: 'Regular turf bookers',
    count: '34,200',
    share: '83%',
    shareTone: 'green',
  },
  {
    id: 'hosts',
    dot: 'var(--info)',
    name: 'Hosts',
    note: 'Venue & pitch managers',
    count: '1,280',
    share: '3%',
    shareTone: 'blue',
  },
  {
    id: 'inactive',
    dot: 'var(--warn)',
    name: 'Inactive',
    note: 'No activity in 30 days',
    count: '5,790',
    share: '14%',
    shareTone: 'amber',
  },
];

const PLAYER_TIERS = [
  {
    id: 'power',
    title: 'Power Players',
    note: '3+ bookings per week · League & tournament regulars',
    count: '6,840',
    share: '20% of players',
  },
  {
    id: 'regular',
    title: 'Regular Players',
    note: '1–2 bookings per month · Weekend casual matches',
    count: '18,810',
    share: '55% of players',
  },
  {
    id: 'new',
    title: 'New Signups',
    note: 'Registered within the last 14 days, no bookings yet',
    count: '8,550',
    share: '25% of players',
  },
];

const HOST_STATUS = [
  { id: 'active', status: 'Active', tone: 'green', count: '1,140', revenue: '৳38,400', share: '89%' },
  { id: 'pending', status: 'Pending', tone: 'amber', count: '92', revenue: '—', share: '7%' },
  { id: 'suspended', status: 'Suspended', tone: 'red', count: '48', revenue: '৳0', share: '4%' },
];

const REGIONS = [
  { id: 'dhanmondi', name: 'Dhanmondi', width: '30%', color: 'var(--brand)', value: '12,450 · 30%' },
  { id: 'uttara', name: 'Uttara', width: '24%', color: 'var(--info)', value: '9,890 · 24%' },
  { id: 'mirpur', name: 'Mirpur', width: '20%', color: 'var(--info)', value: '8,240 · 20%' },
  { id: 'khilgaon', name: 'Khilgaon', width: '14%', color: 'var(--warn)', value: '5,780 · 14%' },
  {
    id: 'mohammadpur',
    name: 'Mohammadpur',
    width: '12%',
    color: 'var(--warn)',
    value: '4,910 · 12%',
  },
];

const COHORTS = [
  {
    id: 'power',
    cohort: 'Power Players',
    users: '6,840',
    bookings: '12.4',
    retention: '96%',
    retentionStyle: {
      color: 'var(--brand)',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    spend: '৳2,880',
    ltv: '৳18,200',
    ltvStyle: { fontWeight: 700 },
  },
  {
    id: 'regular',
    cohort: 'Regular Players',
    users: '18,810',
    bookings: '2.1',
    retention: '82%',
    retentionStyle: {
      color: 'var(--brand-600)',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    spend: '৳540',
    ltv: '৳3,800',
    ltvStyle: { fontWeight: 700 },
  },
  {
    id: 'new',
    cohort: 'New Signups',
    users: '8,550',
    bookings: '0.0',
    retention: '—',
    retentionStyle: { color: 'var(--text-3)', fontFamily: 'var(--font-display)' },
    spend: '৳0',
    ltv: '৳0',
    ltvStyle: { color: 'var(--text-3)' },
  },
  {
    id: 'hosts',
    cohort: 'Active Hosts',
    users: '1,140',
    bookings: '—',
    retention: '94%',
    retentionStyle: {
      color: 'var(--brand)',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    spend: '৳38,400',
    ltv: '৳92,000',
    ltvStyle: { fontWeight: 700 },
  },
];

const HISTORY_ITEM_STYLE = {
  padding: '14px 18px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-soft)',
};

const REGION_ITEM_STYLE = {
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-soft)',
};

const BARE_TABLE_WRAP = {
  padding: 0,
  background: 'transparent',
  border: 0,
  boxShadow: 'none',
};

export default function UserSegmentsPage() {
  return (
    <>
      <PageTitle title="User Segment Breakdown" />

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
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>User Segment Breakdown</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Distribution across player roles, venue partners, and geographic regions
          </span>
        </div>
      </div>

      <div className="grid4" style={{ gap: 20, marginBottom: 28 }}>
        {KPIS.map((kpi) => (
          <div className="liquid-glass kpi-card" key={kpi.id}>
            <div>
              <div className="between">
                <span className="label" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                  {kpi.label}
                </span>
                <Icon name={kpi.icon} style={{ color: kpi.color }} />
              </div>
              <b
                className="value num"
                style={{ color: kpi.color, fontSize: 36, display: 'block', margin: '6px 0 2px' }}
              >
                {kpi.value}
              </b>
              <span className={kpi.deltaClass} style={kpi.deltaStyle}>
                {kpi.deltaText}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ gap: 24, marginBottom: 28 }}>
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="activity" style={{ color: 'var(--brand)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Share Distribution</h3>
              </div>
              <span className="subtle small">User base composition</span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '170px 1fr',
              gap: 20,
              alignItems: 'center',
              minHeight: 200,
            }}
          >
            <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto' }}>
              <ChartCanvas
                type="doughnut"
                data={DONUT_DATA}
                options={DONUT_OPTIONS}
                height={170}
                label="User distribution: 83% Players, 3% Hosts, 14% Inactive"
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    display: 'block',
                    lineHeight: 1,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  41.2K
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-3)',
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                  }}
                >
                  TOTAL
                </span>
              </div>
            </div>

            <div className="user-breakdown-legend">
              {SHARE_LEGEND.map((item) => (
                <div className="legend-item" key={item.id}>
                  <div>
                    <span className="legend-dot" style={{ background: item.dot }}></span>
                    <b style={{ fontSize: 14 }}>{item.name}</b>
                    <span className="tiny subtle" style={{ display: 'block' }}>
                      {item.note}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: 15, display: 'block' }}>{item.count}</b>
                    <span className={`tiny badge ${item.shareTone} nodot`}>{item.share}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="stack-sm" style={{ gap: 14, marginBottom: 20 }}>
            <div className="row" style={{ gap: 8 }}>
              <Icon name="user" style={{ color: 'var(--mint)' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Player Classification</h3>
            </div>
            <span className="subtle small">Usage tiers among active players</span>
          </div>

          <div className="stack-sm" style={{ gap: 6 }}>
            {PLAYER_TIERS.map((tier) => (
              <div className="history-item between" key={tier.id} style={HISTORY_ITEM_STYLE}>
                <div>
                  <b className="small" style={{ display: 'block', fontWeight: 700 }}>
                    {tier.title}
                  </b>
                  <span className="tiny subtle">{tier.note}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b style={{ fontSize: 15, display: 'block' }}>{tier.count}</b>
                  <span className="tiny subtle">{tier.share}</span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border-soft)' }}
          >
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <Icon name="pin" style={{ color: 'var(--info)' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Host Status Breakdown</h3>
            </div>
            <div className="table-wrap" style={BARE_TABLE_WRAP}>
              <table className="table" aria-label="Host status breakdown">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="num">Count</th>
                    <th className="num">Avg Revenue/mo</th>
                    <th className="num">% of Hosts</th>
                  </tr>
                </thead>
                <tbody>
                  {HOST_STATUS.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className={`badge ${row.tone} nodot`} style={{ fontSize: 11 }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="num">{row.count}</td>
                      <td className="num">{row.revenue}</td>
                      <td className="num">{row.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Distribution */}
      <div className="liquid-glass" style={{ padding: 24, borderRadius: 20, marginBottom: 28 }}>
        <div className="row" style={{ gap: 8, marginBottom: 18 }}>
          <Icon name="pin" style={{ color: 'var(--mint)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Regional Distribution</h3>
        </div>
        <div className="stack-sm">
          {REGIONS.map((region) => (
            <div className="history-item between" key={region.id} style={REGION_ITEM_STYLE}>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{region.name}</span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: 'var(--surface-3)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: region.width,
                    height: '100%',
                    borderRadius: 4,
                    background: region.color,
                    transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                  }}
                ></div>
              </div>
              <span
                className="num"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  minWidth: 100,
                  textAlign: 'right',
                  color: 'var(--text-2)',
                }}
              >
                {region.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Cohort Overview */}
      <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          <Icon name="activity" style={{ color: 'var(--brand)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Engagement Cohort Overview</h3>
        </div>
        <div className="table-wrap" style={BARE_TABLE_WRAP}>
          <table className="table" aria-label="Engagement cohort breakdown">
            <thead>
              <tr>
                <th>Cohort</th>
                <th className="num">Users</th>
                <th className="num">Avg Bookings/mo</th>
                <th className="num">Retention Rate</th>
                <th className="num">Avg Spend</th>
                <th className="num">LTV</th>
              </tr>
            </thead>
            <tbody>
              {COHORTS.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b>{row.cohort}</b>
                  </td>
                  <td className="num">{row.users}</td>
                  <td className="num">{row.bookings}</td>
                  <td className="num" style={row.retentionStyle}>
                    {row.retention}
                  </td>
                  <td className="num">{row.spend}</td>
                  <td className="num" style={row.ltvStyle}>
                    {row.ltv}
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
