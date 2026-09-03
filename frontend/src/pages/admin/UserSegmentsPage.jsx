import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Icon } from '@/components/common/Icon';
import { PageTitle } from '@/components/common/PageTitle';
import { CountUp } from '@/components/ui/CountUp';
import { Button } from '@/components/buttons/Button';
import { paths } from '@/routes/paths';
import { api } from '@/api/client';
import { listAdminUsers, adminUserRows } from '@/api/adminUsers';
import { useApi } from '@/hooks/useApi';

const DONUT_OPTIONS = {
  cutout: '71%',
  plugins: { legend: { display: false } },
};

const SEGMENT_COLORS = {
  players: '#22C55E',
  hosts: '#60A5FA',
  inactive: '#FBBF24',
  other: '#A855F7',
};

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
  const { data: res, loading, error, reload } = useApi(() => api('/admin/analytics/segments'));
  const segments = res?.data || res;

  const totalUsers = segments?.totalUsers ?? 0;
  const playerCount = segments?.playerCount ?? 0;
  const hostCount = segments?.hostCount ?? 0;
  const inactiveCount = segments?.inactiveCount ?? 0;
  const avgLtv = segments?.avgLifetimeValueBdt ?? 0;
  const otherCount = Math.max(0, totalUsers - playerCount - hostCount - inactiveCount);

  const donutData = useMemo(() => {
    const slices = [playerCount, hostCount, inactiveCount];
    const colors = [SEGMENT_COLORS.players, SEGMENT_COLORS.hosts, SEGMENT_COLORS.inactive];
    const names = ['Players', 'Hosts', 'Inactive'];
    if (otherCount > 0) {
      slices.push(otherCount);
      colors.push(SEGMENT_COLORS.other);
      names.push('Other');
    }
    return {
      labels: names,
      datasets: [{ data: slices, backgroundColor: colors, borderWidth: 0, spacing: 4 }],
    };
  }, [playerCount, hostCount, inactiveCount, otherCount]);

  const shareLegend = useMemo(() => {
    const total = totalUsers || 1;
    const items = [
      {
        id: 'players',
        dot: SEGMENT_COLORS.players,
        name: 'Players',
        note: 'Regular turf bookers',
        count: playerCount,
        share: (playerCount / total) * 100,
        shareTone: 'green',
      },
      {
        id: 'hosts',
        dot: SEGMENT_COLORS.hosts,
        name: 'Hosts',
        note: 'Venue & pitch managers',
        count: hostCount,
        share: (hostCount / total) * 100,
        shareTone: 'blue',
      },
      {
        id: 'inactive',
        dot: SEGMENT_COLORS.inactive,
        name: 'Inactive',
        note: 'No activity in 30 days',
        count: inactiveCount,
        share: (inactiveCount / total) * 100,
        shareTone: 'amber',
      },
    ];
    if (otherCount > 0) {
      items.push({
        id: 'other',
        dot: SEGMENT_COLORS.other,
        name: 'Other',
        note: 'Admins & remaining accounts',
        count: otherCount,
        share: (otherCount / total) * 100,
        shareTone: 'purple',
      });
    }
    return items.map((item) => ({
      ...item,
      count: item.count.toLocaleString('en-IN'),
      share: item.share.toFixed(1) + '%',
    }));
  }, [totalUsers, playerCount, hostCount, inactiveCount, otherCount]);

  const centerTotal = totalUsers >= 1000 ? `${(totalUsers / 1000).toFixed(1)}K` : String(totalUsers || '—');

  const { data: usersRes } = useApi(() => listAdminUsers(undefined, undefined, undefined, 0, 100), []);
  const regions = useMemo(() => {
    const arr = adminUserRows(usersRes).filter((u) => u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN');
    const counts = {};
    arr.forEach((u) => {
      const area = u.area || 'Unknown';
      counts[area] = (counts[area] || 0) + 1;
    });
    const total = arr.length || 1;
    const colors = ['var(--brand)', 'var(--info)', 'var(--info)', 'var(--warn)', 'var(--warn)'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], index) => ({
        id: name,
        name,
        width: `${(count / total) * 100}%`,
        color: colors[index % colors.length],
        value: `${count.toLocaleString('en-IN')} · ${((count / total) * 100).toFixed(1)}%`,
      }));
  }, [usersRes]);

  const kpiData = [
    {
      id: 'players',
      label: 'Active Players',
      icon: 'users',
      color: 'var(--brand)',
      value: playerCount,
      deltaClass: 'delta up',
      deltaStyle: { fontSize: 12 },
      deltaText: 'Regular turf bookers',
    },
    {
      id: 'hosts',
      label: 'Verified Hosts',
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
      deltaClass: 'delta down',
      deltaStyle: { fontSize: 12 },
      deltaText: 'No activity in 30 days',
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
      deltaText: 'Per registered user',
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
        {loading ? (
          // Zeros + CountUp-to-zero fabricated data before the response
          // landed; a plain loading card is honest.
          <div className="liquid-glass kpi-card" style={{ gridColumn: '1 / -1', padding: 24 }}>
            <span className="label">Loading segments…</span>
            <b className="value">—</b>
          </div>
        ) : error ? (
          <div className="liquid-glass kpi-card" style={{ gridColumn: '1 / -1', padding: 24 }}>
            <span className="label">Could not load segments</span>
            <p className="subtle small" style={{ margin: '4px 0 12px' }}>
              The figures below may be empty. Try again.
            </p>
            <Button size="sm" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : kpiData.map((kpi, index) => (
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
                data={donutData}
                options={DONUT_OPTIONS}
                height={170}
                label="Live user distribution across players, hosts, inactive and other accounts"
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
                  {centerTotal}
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
              {shareLegend.map((item) => (
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
            {((segments && segments.playerTiers) || []).map((tier) => (
              <div className="history-item between" key={tier.id} style={HISTORY_ITEM_STYLE}>
                <div>
                  <b className="small" style={{ display: 'block', fontWeight: 700 }}>
                    {tier.title}
                  </b>
                  <span className="tiny subtle">{tier.note}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b style={{ fontSize: 15, display: 'block' }}>{tier.count.toLocaleString('en-IN')}</b>
                  <span className="tiny subtle">{tier.share.toFixed(1)}% of players</span>
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
                  {((segments && segments.hostStatus) || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className={`badge ${row.tone} nodot`} style={{ fontSize: 11 }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="num">{row.count.toLocaleString('en-IN')}</td>
                      <td className="num">
                        {row.avgRevenuePerMonth > 0 ? `৳${row.avgRevenuePerMonth.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="num">{row.share.toFixed(1)}%</td>
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
        <span className="subtle small" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>
          Share of the 100 most recent accounts, not of the whole platform
        </span>
        <div className="stack-sm">
          {regions.map((region) => (
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
              {((segments && segments.cohorts) || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <b>{row.cohort}</b>
                  </td>
                  <td className="num">{row.users.toLocaleString('en-IN')}</td>
                  <td className="num">{row.avgBookingsPerMonth.toFixed(1)}</td>
                  <td
                    className="num"
                    style={{
                      color: row.retentionRate == null ? 'var(--text-3)' : row.retentionRate >= 50 ? 'var(--brand)' : 'var(--warn)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                    }}
                  >
                    {row.retentionRate == null ? '—' : `${row.retentionRate.toFixed(1)}%`}
                  </td>
                  <td className="num">৳{row.avgSpend.toLocaleString('en-IN')}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    ৳{row.ltv.toLocaleString('en-IN')}
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
