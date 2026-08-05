import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Chip } from '@/components/ui/Chip';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = [
  { id: 'pending', label: 'Pending (4)' },
  { id: 'changes', label: 'Changes Requested (2)' },
  { id: 'approved', label: 'Approved (3)' },
  { id: 'rejected', label: 'Rejected (1)' },
];

const REQUESTS = [
  {
    id: 'TR-1042',
    venue: 'Kick Off Arena',
    venueNote: '3 pitches · Football / Futsal',
    owner: 'Mahmudul Hasan',
    phone: '+880 1811 ••• 344',
    area: 'Dhanmondi',
    docs: '3/3 Verified ✓',
    docsTone: 'green',
    wait: '4h',
    status: 'Pending Review',
    statusTone: 'amber',
    action: { kind: 'review', label: 'Review Request →', variant: 'btn-primary' },
  },
  {
    id: 'TR-1041',
    venue: 'Uttara Champions Field',
    venueNote: '2 pitches · Outdoor Grass',
    owner: 'Salma Khatun',
    phone: '+880 1717 ••• 505',
    area: 'Uttara 11',
    docs: '3/3 Verified ✓',
    docsTone: 'green',
    wait: '1d',
    status: 'Pending Review',
    statusTone: 'amber',
    action: { kind: 'review', label: 'Review Request →', variant: 'btn-secondary' },
  },
  {
    id: 'TR-1038',
    venue: 'Banani Rooftop Futsal',
    venueNote: '1 court · Synthetic Turf',
    owner: 'Imran Chowdhury',
    phone: '+880 1913 ••• 227',
    area: 'Banani',
    docs: '2/3 (Trade License pending)',
    docsTone: 'amber',
    wait: '3d ⚠️',
    waitOverdue: true,
    status: 'SLA Overdue',
    statusTone: 'amber',
    rowStyle: { background: 'rgba(251,191,36,0.08)' },
    action: { kind: 'review', label: 'Priority Review →', variant: 'btn-primary' },
  },
  {
    id: 'TR-1036',
    venue: 'Khilgaon Turf Park',
    venueNote: '2 pitches · Multi-sport',
    owner: 'Rubel Mia',
    phone: '+880 1610 ••• 883',
    area: 'Khilgaon',
    docs: '1/3 (Unreadable NID)',
    docsTone: 'red',
    wait: '2d',
    status: 'Changes Requested',
    statusTone: 'blue',
    action: { kind: 'review', label: 'Open Details', variant: 'btn-secondary' },
  },
  {
    id: 'TR-1039',
    venue: 'GreenTurf Annex',
    owner: 'Nusrat Jahan',
    area: 'Mohammadpur',
    docs: '3/3 Verified ✓',
    docsTone: 'green',
    wait: '—',
    status: 'Approved by Farid',
    statusTone: 'green',
    rowStyle: { opacity: 0.75 },
    action: { kind: 'listing', label: 'View Listing', variant: 'btn-tertiary' },
  },
  {
    id: 'TR-1037',
    venue: 'Old Town Court',
    owner: 'Kamal Uddin',
    area: 'Lalbagh',
    docs: 'Expired Trade License',
    docsTone: 'red',
    wait: '—',
    status: 'Rejected',
    statusTone: 'red',
    rowStyle: { opacity: 0.75 },
    action: {
      kind: 'reason',
      label: 'Reason',
      variant: 'btn-tertiary',
      toast: 'Rejection Note: Trade license expired March 2026',
    },
  },
];

export default function TurfRequestsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['pending']);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return REQUESTS;
    return REQUESTS.filter(
      (request) =>
        request.venue.toLowerCase().includes(term) || request.owner.toLowerCase().includes(term),
    );
  }, [search]);

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
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Turf Listing Requests</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Verify new venue submissions · Target SLA: 48 hours
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge amber">4 Pending Approval</span>
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
            {rows.map((request) => (
              <tr key={request.id} style={request.rowStyle}>
                <td className="num">
                  <b>{request.id}</b>
                </td>
                <td>
                  <b>{request.venue}</b>
                  {request.venueNote ? (
                    <>
                      <br />
                      <span className="tiny subtle">{request.venueNote}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  {request.owner}
                  {request.phone ? (
                    <>
                      <br />
                      <span className="tiny subtle num">{request.phone}</span>
                    </>
                  ) : null}
                </td>
                <td>{request.area}</td>
                <td>
                  <span className={`badge ${request.docsTone} nodot`}>{request.docs}</span>
                </td>
                <td
                  className="num"
                  style={request.waitOverdue ? { color: 'var(--warn)', fontWeight: 700 } : undefined}
                >
                  {request.wait}
                </td>
                <td>
                  <span className={`badge ${request.statusTone}`}>{request.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {request.action.kind === 'review' ? (
                    <Link
                      className={`btn btn-sm ${request.action.variant}`}
                      to={paths.admin.requestReview(request.id)}
                    >
                      {request.action.label}
                    </Link>
                  ) : null}
                  {request.action.kind === 'listing' ? (
                    <Link className={`btn btn-sm ${request.action.variant}`} to={paths.admin.turfs}>
                      {request.action.label}
                    </Link>
                  ) : null}
                  {request.action.kind === 'reason' ? (
                    <button
                      className={`btn btn-sm ${request.action.variant}`}
                      type="button"
                      onClick={() => showToast(request.action.toast)}
                    >
                      {request.action.label}
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
