import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/buttons/Button';
import { paths } from '@/routes/paths';
import { listAdminVenues } from '@/api/adminVenues';
import { useApi } from '@/hooks/useApi';

const FILTERS = [
  { id: 'all', label: 'All Turfs' },
  { id: 'live', label: 'Live' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
];

export default function TurfsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: res, loading, error, reload } = useApi(
    () => listAdminVenues(activeFilter === 'all' ? null : activeFilter),
    [activeFilter],
  );

  const apiVenues = res?.data ?? res;
  const venuesList = useMemo(() => {
    if (!Array.isArray(apiVenues)) return [];
    return apiVenues.map((v) => ({
      id: v.venueCode || `V-${v.id}`,
      dbId: v.id,
      name: v.name ?? 'Unnamed venue',
      // The admin venue projection sends `ownerName`; reading `owner.fullName`
      // silently produced the literal "Owner" for every row.
      owner: v.ownerName || v.owner?.fullName || '—',
      phone: v.contactPhone || v.owner?.phone || '—',
      area: v.area || '—',
      rating: v.ratingAvg != null ? `${v.ratingAvg} ★` : '—',
      status: v.status || 'DRAFT',
      badgeClass: v.status === 'LIVE' ? 'green' : v.status === 'SUSPENDED' ? 'red' : 'amber',
      pitches: Array.isArray(v.pitches) ? v.pitches.length : null,
    }));
  }, [apiVenues]);

  const filteredVenues = useMemo(() => {
    let list = venuesList;
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (v) =>
          String(v.name ?? '').toLowerCase().includes(term) ||
          String(v.owner ?? '').toLowerCase().includes(term) ||
          String(v.area ?? '').toLowerCase().includes(term) ||
          String(v.id).toLowerCase().includes(term),
      );
    }
    return list;
  }, [venuesList, search]);

  return (
    <>
      <PageTitle title="All Turfs & Venues" />

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
            <h1>All Turfs &amp; Venues</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Overview and administrative controls for all registered turf venues
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge green">{filteredVenues.length} Venues Listed</span>
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
          style={{ maxWidth: 260, marginLeft: 'auto' }}
          placeholder="🔍 Search name, owner, area..."
          aria-label="Search turf"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {/* Table */}
      <TableScroll label="Venues" className="liquid-glass" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Venue Name</th>
              <th>Owner / Contact</th>
              <th>Area</th>
              <th>Rating</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading venues...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                  Could not load venues.{' '}
                  <Button size="sm" variant="secondary" style={{ marginLeft: 8 }} onClick={reload}>
                    Try again
                  </Button>
                </td>
              </tr>
            ) : filteredVenues.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="subtle">
                  {search ? `No venues match "${search}"` : 'No venues in this view.'}
                </td>
              </tr>
            ) : filteredVenues.map((venue) => (
              <tr key={venue.id} style={venue.rowTone ? { background: venue.rowTone } : undefined}>
                <td className="num">
                  <b>{venue.id}</b>
                </td>
                <td>
                  <b>{venue.name}</b>
                  <br />
                  <span className="tiny subtle">
                    {venue.pitches != null ? `${venue.pitches} Pitches` : 'Pitches —'}
                  </span>
                </td>
                <td>
                  {venue.owner}
                  <br />
                  <span className="tiny subtle num">{venue.phone}</span>
                </td>
                <td>{venue.area}</td>
                <td className="num font-semibold">{venue.rating}</td>
                <td>
                  <span className={`badge ${venue.badgeClass}`}>
                    {venue.status === 'PENDING_LISTING'
                      ? 'Pending listing'
                      : venue.status.charAt(0) + venue.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link
                    className="btn btn-sm btn-secondary"
                    to={paths.admin.turfDetails(venue.dbId || venue.id)}
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </>
  );
}
