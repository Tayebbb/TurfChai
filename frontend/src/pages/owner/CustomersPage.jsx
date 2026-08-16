import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { getOwnerCustomers } from '@/api/ownerCustomers';

const FILTERS = ['All', 'Regulars (4+ visits)', 'VIPs (10+ visits)', 'Has no-shows'];

/** The chips used to be decorative — every one of them showed the same list. */
function matchesFilters(row, chips) {
  if (chips.isActive('All')) return true;
  const visits = Number(row.confirmedVisits ?? 0);
  const checks = [];
  if (chips.isActive('Regulars (4+ visits)')) checks.push(visits >= 4);
  if (chips.isActive('VIPs (10+ visits)')) checks.push(visits >= 10);
  if (chips.isActive('Has no-shows')) checks.push(Number(row.noShows ?? 0) > 0);
  return checks.length === 0 || checks.some(Boolean);
}

export default function CustomersPage() {
  const chips = useFilterChips(['All']);
  const [query, setQuery] = useState('');

  // "All" is a reset, not another chip: leaving it selected alongside a real
  // filter is what made the filters look like they did nothing.
  const selectFilter = (filter) => {
    if (filter === 'All') {
      chips.clear();
      chips.toggle('All');
      return;
    }
    if (chips.isActive('All')) chips.toggle('All');
    chips.toggle(filter);
  };

  const { data: res, loading } = useApi(getOwnerCustomers, []);
  const customers = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

  const term = query.trim().toLowerCase();
  const visible = customers
    .filter((row) => (term ? `${row.name} ${row.phone}`.toLowerCase().includes(term) : true))
    .filter((row) => matchesFilters(row, chips));

  return (
    <>
      <PageTitle title="Customers" />

      <div className="main-header">
        <div>
          <h1>Customers</h1>
          <span className="subtle small">Every player and team who has booked with you</span>
        </div>
        <Button
          variant="primary"
          disabled
          title="Customers are derived from real bookings, so there is nothing to add by hand."
        >
          + Add customer
        </Button>
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <Input
          style={{ maxWidth: 260 }}
          placeholder="🔍 Search name or phone…"
          aria-label="Search customers"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {FILTERS.map((filter) => (
          <Chip key={filter} active={chips.isActive(filter)} onToggle={() => selectFilter(filter)}>
            {filter}
          </Chip>
        ))}
      </div>

      <TableScroll label="Customers" className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th className="num">Bookings</th>
              <th className="num">Total spend</th>
              <th>Last visit</th>
              <th>Standing at your venue</th>
              <th className="num">No-shows</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar size="sm" initials={row.initials} tone={row.tone} />
                    <b>{row.name}</b>
                    {row.suffix ? <span className="tiny subtle">{row.suffix}</span> : null}
                  </div>
                </td>
                <td className="num small">{row.phone}</td>
                <td className="num">{row.bookings}</td>
                <td className="num">{row.spend}</td>
                <td>{row.lastVisit}</td>
                <td>
                  {row.loyalty && (
                    <Badge tone={row.loyalty.tone} dot={false}>
                      {row.loyalty.text}
                    </Badge>
                  )}
                </td>
                <td className="num" style={row.noShowsDanger ? { color: 'var(--danger)' } : undefined}>
                  {row.noShows}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="tertiary"
                    disabled
                    title="Customer notes are not stored yet — this row has no note to show."
                  >
                    📝
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="center subtle small" style={{ padding: '32px 0' }}>
                  No customers found
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="center subtle small" style={{ padding: '32px 0' }}>
                  Loading customers...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {visible.length > 0 && (
        <Alert tone="info" icon="🎁" title="Reward your regulars" style={{ marginTop: 14 }}>
          Send a venue-loyalty offer from <Link to={paths.owner.promotions}>Promotions</Link>.
        </Alert>
      )}
    </>
  );
}