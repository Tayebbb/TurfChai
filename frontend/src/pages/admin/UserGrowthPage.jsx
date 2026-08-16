import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { PageTitle } from '@/components/common/PageTitle';
import { apiGet } from '@/api/client';
import { listAdminUsers } from '@/api/adminUsers';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import './UserGrowthPage.css';

// ── Placeholder cards (shown while loading or when analytics are unavailable) ─
// Values are deliberately '—' so no fabricated numbers are ever displayed.
const PLACEHOLDER_KPIS = [
  { id: 'total',     label: 'TOTAL REGISTERED',   value: '—', valueColor: undefined,         note: 'Cumulative users' },
  { id: 'new',       label: 'NEW REGISTRATIONS',   value: '—', valueColor: 'var(--brand-600)', note: 'Daily growth velocity' },
  { id: 'active',    label: 'ACTIVE RATIO',        value: '—', valueColor: 'var(--mint)',    note: 'Active monthly users' },
  { id: 'retention', label: 'RETENTION RATE',      value: '—', valueColor: 'var(--info)',    note: '30-day user return' },
];

const SIGNUP_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
    x: { grid: { display: false } },
  },
};

const BARE_TABLE_WRAP = { padding: 0, borderRadius: 12, background: 'transparent', border: 0, boxShadow: 'none' };

/**
 * Formats a large number for KPI cards (e.g. 41270 → "41,270").
 */
function fmt(n) {
  return Number(n).toLocaleString('en-IN');
}

function relativeTime(iso) {
  if (!iso) return '—';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function roleLabel(role) {
  if (role === 'HOST' || role === 'OWNER') return 'Host';
  if (role === 'SOLO_PLAYER') return 'Solo';
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'Admin';
  return 'Player';
}

function roleTone(role) {
  if (role === 'HOST' || role === 'OWNER') return 'blue';
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'purple';
  return 'green';
}

export default function UserGrowthPage() {
  const [kpis, setKpis] = useState([]);
  const [signupData, setSignupData] = useState({ labels: [], datasets: [] });
  const [channels, setChannels] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(false);

  const { data: usersRes } = useApi(() => listAdminUsers(), []);
  const stream = useMemo(() => {
    const arr = Array.isArray(usersRes?.data)
      ? usersRes.data
      : Array.isArray(usersRes)
        ? usersRes
        : [];
    return [...arr]
      .filter((u) => u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map((u) => ({
        id: `#${u.id}`,
        name: u.fullName || '—',
        role: roleLabel(u.role),
        roleTone: roleTone(u.role),
        area: u.area || '—',
        email: u.email || '—',
        joined: relativeTime(u.createdAt),
      }));
  }, [usersRes]);

  useEffect(() => {
    let cancelled = false;

    async function fetchGrowth() {
      try {
        const json = await apiGet('/api/v1/admin/analytics/growth');
        // A 200 that carries no payload is still a failure. Returning quietly
        // left the badge saying "Loading..." for as long as the page was open.
        if (!json.success || !json.data) {
          if (!cancelled) setError(true);
          return;
        }

        if (cancelled) return;

        const d = json.data;

        setKpis([
          {
            id: 'total',
            label: 'TOTAL REGISTERED',
            value: fmt(d.totalUsers),
            valueColor: undefined,
            note: 'Cumulative users',
          },
          {
            id: 'new',
            label: 'NEW REGISTRATIONS',
            value: `+${fmt(d.newUsersToday)} Today`,
            valueColor: 'var(--brand-600)',
            note: 'Daily growth velocity',
          },
          {
            id: 'active',
            label: 'ACTIVE RATIO',
            value: `${d.activeRatio.toFixed(1)}%`,
            valueColor: 'var(--mint)',
            note: `${fmt(Math.round(d.totalUsers * d.activeRatio / 100))} active MAU`,
          },
          {
            id: 'retention',
            label: 'RETENTION RATE',
            value: d.retentionRate == null ? '—' : `${d.retentionRate.toFixed(1)}%`,
            valueColor: 'var(--info)',
            note: d.retentionRate == null ? 'Not enough account history yet' : '30-day user return',
          },
        ]);

        setSignupData({
          labels: d.signupLabels,
          datasets: [
            {
              data: d.signupCounts,
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
        });

        setIsLive(true);
        setChannels(d.channels || []);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    fetchGrowth();
    return () => { cancelled = true; };
  }, []);

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
            <h1>User Growth &amp; Acquisition</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Detailed metrics for signup growth and acquisition channels
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {(isLive ? kpis : PLACEHOLDER_KPIS).map((kpi) => (
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
        className="admin-stack-mobile"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 28,
        }}
      >
        {/* Signup Growth Chart */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Signup Growth Curve</h3>
              <span className="subtle small">
                Daily registration registrations over past week
              </span>
            </div>
            <span className={`badge nodot ${isLive ? 'blue' : error ? 'yellow' : 'gray'}`}>
              {isLive ? 'Live Analytics' : error ? 'Unavailable' : 'Loading…'}
            </span>
          </div>
          <ChartCanvas
            type="line"
            data={signupData}
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
                {channels.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.channel}</b></td>
                    <td className="num font-semibold">{fmt(row.newUsers)}</td>
                    <td className="num font-semibold">{row.conversionRate.toFixed(1)}%</td>
                    <td className="num font-semibold">{row.cac}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Real-Time Registration Stream */}
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
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Time Joined</th>
              </tr>
            </thead>
            <tbody>
              {stream.map((row) => (
                <tr key={row.id}>
                  <td className="num"><b>{row.id}</b></td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`badge ${row.roleTone} nodot`}>{row.role}</span>
                  </td>
                  <td>{row.area}</td>
                  <td>{row.email}</td>
                  <td style={{ textAlign: 'right' }} className="num">{row.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
