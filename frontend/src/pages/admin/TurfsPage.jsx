
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Chip } from '@/components/ui/Chip';
import { adminVenues } from '@/data/admin';
import { useFilterChips } from '@/hooks/useFilterChips';
import { paths } from '@/routes/paths';

const FILTERS = [
  { id: 'all', label: 'All Turfs' },
  { id: 'live', label: 'Live' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
];

export default function TurfsPage() {
  const chips = useFilterChips(['all']);
  const [search, setSearch] = useState('');

  const filteredVenues = useMemo(() => {
    let list = adminVenues;
    const activeChip = chips.active[0] || 'all';

    if (activeChip === 'live') {
      list = list.filter((v) => v.status === 'Live');
    } else if (activeChip === 'pending') {
      list = list.filter((v) => v.status.includes('Pending'));
    } else if (activeChip === 'suspended') {
      list = list.filter((v) => v.status.includes('Suspended'));
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          v.owner.toLowerCase().includes(term) ||
          v.area.toLowerCase().includes(term) ||
          v.id.toLowerCase().includes(term),
      );
    }
    return list;
  }, [chips.active, search]);

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
          <span className="badge green">{adminVenues.length} Venues Listed</span>
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
          style={{ maxWidth: 260, marginLeft: 'auto' }}
          placeholder="🔍 Search name, owner, area..."
          aria-label="Search turf"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {/* Table */}
      <div className="liquid-glass table-wrap" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Venue Name</th>
              <th>Owner / Contact</th>
              <th>Area</th>
              <th>Rating</th>
              <th>30d Revenue</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredVenues.map((venue) => (
              <tr key={venue.id} style={venue.rowTone ? { background: venue.rowTone } : undefined}>
                <td className="num">
                  <b>{venue.id}</b>
                </td>
                <td>
                  <b>{venue.name}</b>
                  <br />
                  <span className="tiny subtle">{venue.pitches} Pitches</span>
                </td>
                <td>
                  {venue.owner}
                  <br />
                  <span className="tiny subtle num">{venue.phone}</span>
                </td>
                <td>{venue.area}</td>
                <td className="num font-semibold">{venue.rating}</td>
                <td className="num font-semibold">{venue.revenue30d}</td>
                <td>
                  <span className={`badge ${venue.badgeClass}`}>{venue.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link
                    className="btn btn-sm btn-secondary"
                    to={paths.admin.turfDetails(venue.id)}
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
