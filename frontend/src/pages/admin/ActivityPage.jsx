import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';

const FILTERS = [
  'All Activity',
  'Approvals',
  'Rejections',
  'User Suspensions',
  'System Alerts',
];

const DANGER_AVATAR = { background: 'var(--danger-soft)', color: 'var(--danger)' };

function initialsOf(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(isoStr) {
  if (!isoStr) return 'Recently';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

export default function ActivityPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All Activity');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filterQuery = filter === 'All Activity' ? '' : filter;
  const { data: res, loading } = useApi(
    () => api(`/admin/audit-log?page=${page}&size=10${filterQuery ? `&filter=${encodeURIComponent(filterQuery)}` : ''}`),
    [page, filter],
  );

  const pageData = res?.data || res;
  const rawLogs = pageData?.content || [];
  const totalElements = pageData?.totalElements || rawLogs.length;

  const term = search.trim().toLowerCase();
  const rows = term
    ? rawLogs.filter(
        (entry) =>
          entry.action?.toLowerCase().includes(term) ||
          entry.adminName?.toLowerCase().includes(term) ||
          entry.target?.toLowerCase().includes(term) ||
          entry.details?.toLowerCase().includes(term),
      )
    : rawLogs;

  return (
    <>
      <PageTitle title="System Audit Log" />

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
            <h1>System Audit &amp; Activity Log</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Immutable Record of Administrative &amp; Automated Actions
          </span>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => showToast('Exporting activity-log.csv 📄')}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="row-wrap" style={{ marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="🔍 Search action, admin, ID…"
          aria-label="Search action, admin, ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {FILTERS.map((item) => (
          <Chip key={item} active={filter === item} onToggle={() => { setFilter(item); setPage(0); }}>
            {item}
          </Chip>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="card table-wrap" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Administrator</th>
              <th>Action Performed</th>
              <th>Target Object</th>
              <th>Details &amp; Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading audit entries...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>No audit entries found.</td>
              </tr>
            ) : (
              rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="num">{formatDate(entry.createdAt)}</td>
                  <td>
                    <span className="avatar sm">
                      {initialsOf(entry.adminName)}
                    </span>{' '}
                    {entry.adminName}
                  </td>
                  <td>
                    <span className={`badge ${entry.actionTone || 'blue'} nodot`}>{entry.action}</span>
                  </td>
                  <td className="num">{entry.target || '—'}</td>
                  <td className="small muted">{entry.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="between small" style={{ marginTop: 14 }}>
        <span className="subtle">Showing {rows.length} of {totalElements} audit entries</span>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="btn btn-sm btn-tertiary"
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹ Previous
          </button>
          <button
            className="btn btn-sm btn-tertiary"
            type="button"
            disabled={pageData?.last ?? true}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
        </div>
      </div>
    </>
  );
}