import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { listTurfRequests } from '@/api/turfRequests';
import { useApi } from '@/hooks/useApi';

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'changes_requested', label: 'Changes Requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function TurfRequestsPage() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState('pending');
  const [search, setSearch] = useState('');
  
  const statusFilter = activeFilter.toUpperCase();

  const { data: requestData, loading, error } = useApi(() => listTurfRequests(statusFilter), [statusFilter]);

  const rows = useMemo(() => {
    const items = requestData || [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (req) =>
        req.venueName?.toLowerCase().includes(term) || req.ownerEmail?.toLowerCase().includes(term),
    );
  }, [search, requestData]);

  return (
    <>
      <PageTitle title="Turf Listing Requests" />

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
            <h1>Turf Listing Requests</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Verify new venue submissions · Target SLA: 48 hours
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {/* Pending count: only meaningful on the pending tab (rows are
              already server-filtered by tab). Honest label either way. */}
          <span className="badge amber">
            {activeFilter === 'pending'
              ? `${rows.length} Pending Approval`
              : `Viewing ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="row-wrap" style={{ marginBottom: 16 }}>
        {FILTERS.map((filter) => (
          <Chip
            key={filter.id}
            active={activeFilter === filter.id}
            onToggle={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </Chip>
        ))}
        <input
          className="input"
          style={{ maxWidth: 240, marginLeft: 'auto' }}
          placeholder="🔍 Search venue or owner…"
          aria-label="Search venue or owner"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {/* Turf Request Queue Table */}
      <TableScroll label="Turf listing requests" className="liquid-glass" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Venue Details</th>
              <th>Owner / Contact</th>
              <th>Area</th>
              <th>Docs Status</th>
              <th>Submitted</th>
              <th>Waiting</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="center">Loading requests...</td></tr>}
            {error && <tr><td colSpan="8" className="center" style={{color:'var(--danger)'}}>Failed to load requests</td></tr>}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan="8" className="center subtle">No {activeFilter} requests.</td></tr>
            )}
            {rows.map((request) => (
              <tr key={request.id}>
                <td className="num">
                  <b>{request.requestCode}</b>
                </td>
                <td>
                  <b>{request.venueName}</b>
                  <br />
                  <span className="tiny subtle">{request.pitchCount} pitches · {request.sportsCsv}</span>
                </td>
                <td>
                  {request.ownerEmail}
                  <br />
                  <span className="tiny subtle num">{request.ownerPhone}</span>
                </td>
                <td>{request.area}</td>
                <td>
                  <span
                    className={`badge nodot ${request.docTradeLicense === 'VERIFIED' && request.docOwnerNid === 'VERIFIED' && request.docUtilityBill === 'VERIFIED' ? 'green' : 'amber'}`}
                    title={`Trade license: ${request.docTradeLicense ?? '—'} · NID: ${request.docOwnerNid ?? '—'} · Utility bill: ${request.docUtilityBill ?? '—'}`}
                  >
                    Docs
                  </span>
                </td>
                <td className="num">
                  {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="num" title={request.createdAt ? new Date(request.createdAt).toLocaleString() : undefined}>
                  {/* Real wait time against the 48h SLA, not the submission date. */}
                  {(() => {
                    if (!request.createdAt) return '—';
                    const hours = Math.floor((Date.now() - new Date(request.createdAt).getTime()) / 3600000);
                    if (hours < 1) return '<1h';
                    if (hours < 48) return `${hours}h`;
                    return `${Math.floor(hours / 24)}d${hours % 24 ? ` ${hours % 24}h` : ''}`;
                  })()}
                </td>
                <td>
                  <span className={`badge ${request.status === 'APPROVED' ? 'green' : request.status === 'REJECTED' ? 'red' : request.status === 'CHANGES_REQUESTED' ? 'blue' : 'amber'}`}>
                    {request.status === 'CHANGES_REQUESTED'
                      ? 'Changes requested'
                      : request.status?.charAt(0) + request.status?.slice(1).toLowerCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {(request.status === 'PENDING' || request.status === 'CHANGES_REQUESTED') ? (
                    <Link
                      className="btn btn-sm btn-primary"
                      to={paths.admin.requestReview(request.requestCode)}
                    >
                      Review Request →
                    </Link>
                  ) : request.status === 'REJECTED' && request.adminNote ? (
                    <button
                      className="btn btn-sm btn-tertiary"
                      type="button"
                      onClick={() => showToast(`Reason: ${request.adminNote}`)}
                    >
                      Reason
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </>
  );
}
