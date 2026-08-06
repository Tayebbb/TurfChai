import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Chip } from '@/components/ui/Chip';
import { useFilterChips } from '@/hooks/useFilterChips';
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
  const chips = useFilterChips(['pending']);
  const [search, setSearch] = useState('');
  
  const statusFilter = chips.isActive('pending') ? 'PENDING' : 
                       chips.isActive('changes_requested') ? 'CHANGES_REQUESTED' : 
                       chips.isActive('approved') ? 'APPROVED' : 
                       chips.isActive('rejected') ? 'REJECTED' : null;

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
          <span className="badge amber">
            {Array.isArray(requestData) ? requestData.filter(r => r.status === 'PENDING' || !r.status).length : 0} Pending Approval
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="row-wrap" style={{ marginBottom: 16 }}>
        {FILTERS.map((filter) => (
          <Chip
            key={filter.id}
            active={chips.isActive(filter.id)}
            onToggle={() => chips.toggle(filter.id)}
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
      <div className="liquid-glass table-wrap" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Venue Details</th>
              <th>Owner / Contact</th>
              <th>Area</th>
              <th>Docs Status</th>
              <th>Wait Time</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="center">Loading requests...</td></tr>}
            {error && <tr><td colSpan="8" className="center" style={{color:'var(--danger)'}}>Failed to load requests</td></tr>}
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
                  <span className={`badge nodot ${request.docTradeLicense === 'VERIFIED' && request.docOwnerNid === 'VERIFIED' && request.docUtilityBill === 'VERIFIED' ? 'green' : 'amber'}`}>
                    Docs
                  </span>
                </td>
                <td className="num">
                  {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <span className={`badge ${request.status === 'APPROVED' ? 'green' : request.status === 'REJECTED' ? 'red' : request.status === 'CHANGES_REQUESTED' ? 'blue' : 'amber'}`}>{request.status}</span>
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
      </div>
    </>
  );
}
