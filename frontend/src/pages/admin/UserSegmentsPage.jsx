import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Icon } from '@/components/common/Icon';
import { PageTitle } from '@/components/common/PageTitle';
import { CountUp } from '@/components/ui/CountUp';
import { paths } from '@/routes/paths';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';

// Shared slice styling only — the numbers come from /admin/analytics/segments.
const DONUT_STYLE = {
  backgroundColor: ['#22C55E', '#60A5FA', '#FBBF24'],
  borderWidth: 0,
  spacing: 4,
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
    note: 'Registered player accounts',
    count: (players) => players,
    shareTone: 'green',
  },
  {
    id: 'hosts',
    dot: 'var(--info)',
    name: 'Hosts',
    note: 'Venue & pitch managers',
    count: (players, hosts) => hosts,
    shareTone: 'blue',
  },
  {
    id: 'inactive',
    dot: 'var(--warn)',
    name: 'Inactive',
    note: 'Marked inactive',
    count: (players, hosts, inactive) => inactive,
    shareTone: 'amber',
  },
];

export default function UserSegmentsPage() {
  const { data: res } = useApi(() => api('/admin/analytics/segments'));
  const segments = res?.data || res;

  // These field names must match the API. They did not, so every figure below
  // silently fell back to an invented constant and showed admins a user base
  // roughly fifty times larger than the real one.
  const playerCount = Number(segments?.playerCount ?? 0);
  const hostCount = Number(segments?.hostCount ?? 0);
  const inactiveCount = Number(segments?.inactiveCount ?? 0);
  const totalUsers = Number(segments?.totalUsers ?? 0);
  const avgLtv = Number(segments?.avgLifetimeValueBdt ?? 0);
  const shareOf = (n) => (totalUsers > 0 ? `${Math.round((n / totalUsers) * 100)}%` : '—');

  const kpiData = [
    {
      id: 'players',
      label: 'Players',
      icon: 'users',
      color: 'var(--brand)',
      value: playerCount,
      deltaClass: 'delta nodot',
      deltaStyle: { fontSize: 12 },
      deltaText: 'Registered player accounts',
    },
    {
      id: 'hosts',
      label: 'Hosts',
      icon: 'pin',
      color: 'var(--info)',
      value: hostCount,
      deltaClass: 'delta nodot',
      deltaStyle: { color: 'var(--info)', fontSize: 12 },
      deltaText: 'Registered venue partners',
    },
    {
      id: 'inactive',
      label: 'Inactive Accounts',
      icon: 'alert',
      color: 'var(--warn)',
      value: inactiveCount,
      deltaClass: 'delta nodot',
      deltaStyle: { fontSize: 12 },
      deltaText: 'Marked inactive',
    },
    {
      id: 'ltv',
      label: 'Avg Lifetime Value',
      icon: 'money',
      color: 'var(--brand-600)',
      value: avgLtv,
      prefix: '৳',
      deltaClass: 'delta nodot',
      deltaStyle: { color: 'var(--text-3)', fontSize: 12 },
      deltaText: 'Per registered cohort',
    },
  ];

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
            <h1>User Segment Breakdown</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Distribution across player roles, venue partners, and geographic regions
          </span>
        </div>
      </div>

      <div className="grid4" style={{ gap: 20, marginBottom: 28 }}>
        {kpiData.map((kpi, index) => (
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
                {kpi.prefix && kpi.prefix}
                <CountUp to={typeof kpi.value === 'number' ? kpi.value : Number(String(kpi.value).replace(/[^0-9.]/g, ''))} delay={index * 120} />
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
            className="admin-stack-mobile"
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
                data={{
                  labels: ['Players', 'Hosts', 'Inactive'],
                  datasets: [
                    { ...DONUT_STYLE, data: [playerCount, hostCount, inactiveCount] },
                  ],
                }}
                options={DONUT_OPTIONS}
                height={170}
                label={`User distribution: ${playerCount} players, ${hostCount} hosts, ${inactiveCount} inactive`}
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
                  {totalUsers.toLocaleString('en-IN')}
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
                    <b style={{ fontSize: 15, display: 'block' }}>
                      {item.count(playerCount, hostCount, inactiveCount).toLocaleString('en-IN')}
                    </b>
                    <span className={`tiny badge ${item.shareTone} nodot`}>
                      {shareOf(item.count(playerCount, hostCount, inactiveCount))}
                    </span>
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
            <p className="subtle small" style={{ margin: 0 }}>
              Booking-frequency tiers are not computed yet, so they are left out rather than
              estimated — an invented segment size is worse than none.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
