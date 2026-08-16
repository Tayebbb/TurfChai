import { Link } from 'react-router-dom';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { PageTitle } from '@/components/common/PageTitle';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';
import './UserGrowthPage.css';

const SIGNUP_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
    x: { grid: { display: false } },
  },
};

const LINE_STYLE = {
  borderColor: '#3b82f6',
  backgroundColor: 'rgba(59,130,246,0.35)',
  borderWidth: 3.5,
  tension: 0.4,
  fill: true,
  pointRadius: 4.5,
  pointBackgroundColor: '#ffffff',
  pointBorderColor: '#3b82f6',
  pointBorderWidth: 2.5,
};

const BARE_TABLE_WRAP = { padding: 0, borderRadius: 12, background: 'transparent', border: 0, boxShadow: 'none' };

const ROLE_TONE = { PLAYER: 'green', SOLO_PLAYER: 'green', HOST: 'blue', OWNER: 'blue' };

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

/** "14 mins ago" from a real timestamp. */
function joinedAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ label, value, note, valueColor }) {
  return (
    <div className="stat-card-simple">
      <span className="subtle tiny" style={{ fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-3)' }}>
        {label}
      </span>
      <b
        style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          display: 'block',
          marginTop: 4,
          color: valueColor,
        }}
      >
        {value}
      </b>
      <span className="tiny subtle" style={{ color: 'var(--text-3)' }}>
        {note}
      </span>
    </div>
  );
}

export default function UserGrowthPage() {
  const growthApi = useApi(() => api('/admin/analytics/growth'), []);
  const growth = growthApi.data?.data ?? growthApi.data ?? null;

  const usersApi = useApi(() => api('/admin/users'), []);
  const allUsers = usersApi.data?.data ?? usersApi.data ?? [];

  // Every figure below used to fall back to an invented constant — 41,270
  // registered users on a platform with a few hundred. There is no fallback
  // now: until the API answers, the cards read "—".
  const pending = growthApi.loading;
  const dash = pending ? '…' : '—';

  const kpis = [
    {
      id: 'total',
      label: 'TOTAL REGISTERED',
      value: growth ? fmt(growth.totalUsers) : dash,
      note: 'Cumulative users',
    },
    {
      id: 'new',
      label: 'NEW REGISTRATIONS',
      value: growth ? `+${fmt(growth.newUsersToday)} Today` : dash,
      valueColor: 'var(--brand-600)',
      note: 'Daily growth velocity',
    },
    {
      id: 'active',
      label: 'ACTIVE RATIO',
      value: growth ? `${Number(growth.activeRatio ?? 0).toFixed(1)}%` : dash,
      valueColor: 'var(--mint)',
      note: growth
        ? `${fmt(Math.round((growth.totalUsers * growth.activeRatio) / 100))} active MAU`
        : 'Share of accounts still active',
    },
    {
      id: 'retention',
      label: '30-DAY RETURN RATE',
      // null means the backend could not measure it, not zero.
      value: growth?.retentionRate == null ? dash : `${Number(growth.retentionRate).toFixed(1)}%`,
      valueColor: 'var(--info)',
      note:
        growth && growth.retentionRate == null
          ? 'Not enough account history yet'
          : 'Accounts over 30 days old that booked again',
    },
  ];

  const signupLabels = Array.isArray(growth?.signupLabels) ? growth.signupLabels : [];
  const signupCounts = Array.isArray(growth?.signupCounts) ? growth.signupCounts : [];
  const hasSignupSeries = signupLabels.length > 0 && signupCounts.length > 0;

  const recentSignups = [...(Array.isArray(allUsers) ? allUsers : [])]
    .filter((user) => user?.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

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

      {growthApi.error ? (
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <b>Could not load growth metrics</b>
          <p className="subtle small" style={{ margin: '6px 0 12px' }}>
            {toUserMessage(growthApi.error, 'The analytics service did not respond.')}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={growthApi.reload}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            note={kpi.note}
            valueColor={kpi.valueColor}
          />
        ))}
      </div>

      <div
        className="admin-stack-mobile"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}
      >
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Signup Growth Curve</h3>
              <span className="subtle small">Daily registrations over the past week</span>
            </div>
            {hasSignupSeries ? <span className="badge blue nodot">Live Analytics</span> : null}
          </div>
          {hasSignupSeries ? (
            <ChartCanvas
              type="line"
              data={{ labels: signupLabels, datasets: [{ data: signupCounts, ...LINE_STYLE }] }}
              options={SIGNUP_OPTIONS}
              height={230}
              label="Daily signup growth over the past week"
            />
          ) : (
            <div className="center subtle small" style={{ padding: '72px 12px' }}>
              {pending ? 'Loading signup history…' : 'No signup history available for this period.'}
            </div>
          )}
        </div>

        {/* Referral source is not captured at signup, so there is nothing to
            break down. The table that stood here was entirely invented. */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>
            Acquisition Channels breakdown
          </h3>
          <div className="center subtle small" style={{ padding: '56px 12px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }} aria-hidden="true">
              📡
            </div>
            <b style={{ display: 'block', marginBottom: 6 }}>Not tracked yet</b>
            TurfChai does not record where a signup came from, so there is no
            channel, conversion or acquisition-cost data to show.
          </div>
        </div>
      </div>

      <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>Latest registrations</h3>
        <div className="table-wrap" style={BARE_TABLE_WRAP}>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Name</th>
                <th>Role</th>
                <th>Area</th>
                <th style={{ textAlign: 'right' }}>Time Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((user) => (
                <tr key={user.id}>
                  <td className="num">
                    <b>{user.publicId ? `U-${String(user.publicId).slice(0, 8)}` : `#${user.id}`}</b>
                  </td>
                  <td>{user.fullName || '—'}</td>
                  <td>
                    <span className={`badge ${ROLE_TONE[user.role] ?? 'gray'} nodot`}>
                      {user.role ?? '—'}
                    </span>
                  </td>
                  <td>{user.area || '—'}</td>
                  <td style={{ textAlign: 'right' }} className="num">
                    {joinedAgo(user.createdAt)}
                  </td>
                </tr>
              ))}
              {!usersApi.loading && recentSignups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="center subtle small" style={{ padding: '32px 0' }}>
                    No registrations recorded yet.
                  </td>
                </tr>
              ) : null}
              {usersApi.loading ? (
                <tr>
                  <td colSpan={5} className="center subtle small" style={{ padding: '32px 0' }}>
                    Loading registrations…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
