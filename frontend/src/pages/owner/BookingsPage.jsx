import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { getOwnerBookings } from '@/api/ownerBookings';
import { listMyVenues } from '@/api/ownerVenues';
import { getMyTurfRequests } from '@/api/turfRequests';

export default function BookingsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['Today']);
  const [query, setQuery] = useState('');

  const { data: res, loading } = useApi(getOwnerBookings, []);
  const bookings = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

  const { data: venuesRes } = useApi(listMyVenues, []);
  const venues = Array.isArray(venuesRes) ? venuesRes : (Array.isArray(venuesRes?.data) ? venuesRes.data : []);
  const activeVenue = Array.isArray(venues) && venues.length > 0 ? venues[0] : null;

  const { data: requestsRes } = useApi(getMyTurfRequests, []);
  const latestRequest = Array.isArray(requestsRes) ? requestsRes[0] : null;

  const pitchCount = activeVenue?.pitchCount || activeVenue?.pitches?.length || latestRequest?.pitchCount || 1;
  const pitchFilters = Array.from({ length: pitchCount }, (_, i) => `Pitch ${i + 1}`);

  const filters = [
    'Today',
    'This week',
    ...pitchFilters,
    'Online',
    'Phone',
    'Walk-in',
    'Payment pending',
  ];

  const term = query.trim().toLowerCase();
  const visible = term
    ? bookings.filter((row) =>
        `${row.customer} ${row.sub} ${row.bookingCode} ${row.pitch}`.toLowerCase().includes(term),
      )
    : bookings;

  return (
    <>
      <PageTitle title="Bookings" />

      <div className="main-header">
        <div>
          <h1>Bookings</h1>
          <span className="subtle small">All sources · searchable &amp; filterable ({pitchCount} Pitch{pitchCount > 1 ? 'es' : ''})</span>
        </div>
        <Button variant="primary" onClick={() => showToast('Manual booking drawer — see Calendar page')}>
          + Manual booking
        </Button>
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <Input
          style={{ maxWidth: 260 }}
          placeholder="🔍 Search name, phone, ref…"
          aria-label="Search bookings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {filters.map((filter) => (
          <Chip key={filter} active={chips.isActive(filter)} onToggle={() => chips.toggle(filter)}>
            {filter}
          </Chip>
        ))}
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Ref</th>
              <th>Customer</th>
              <th>Pitch</th>
              <th>Source</th>
              <th className="num">Amount</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} style={row.dim ? { opacity: 0.65 } : undefined}>
                <td className="num">{row.time}</td>
                <td className="num">{row.bookingCode}</td>
                <td>
                  {row.customer}
                  <br />
                  <span className={row.subNum ? 'tiny subtle num' : 'tiny subtle'}>{row.sub}</span>
                </td>
                <td>{row.pitch}</td>
                <td>
                  <Badge tone={row.source.tone} dot={false}>
                    {row.source.text}
                  </Badge>
                </td>
                <td className="num">{row.amountFormatted}</td>
                <td>
                  <Badge tone={row.payment.tone}>{row.payment.text}</Badge>
                </td>
                <td>
                  {row.actions?.length > 1 ? (
                    <div className="row" style={{ gap: 6 }}>
                      {row.actions.map((action) => (
                        <Button
                          key={action.label}
                          size="sm"
                          variant={action.variant}
                          onClick={() => showToast(action.toast)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    row.actions?.length === 1 && (
                      <Button
                        size="sm"
                        variant={row.actions[0].variant}
                        onClick={() => showToast(row.actions[0].toast)}
                      >
                        {row.actions[0].label}
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="center subtle small" style={{ padding: '32px 0' }}>
                  No bookings found
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="center subtle small" style={{ padding: '32px 0' }}>
                  Loading bookings...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="between small" style={{ marginTop: 10 }}>
        <span className="subtle">Showing {visible.length} bookings today</span>
        <div className="row">
          <Button size="sm" variant="tertiary" onClick={() => showToast('Previous page')}>
            ‹ Prev
          </Button>
          <Button size="sm" variant="tertiary" onClick={() => showToast('Next page')}>
            Next ›
          </Button>
        </div>
      </div>
    </>
  );
}