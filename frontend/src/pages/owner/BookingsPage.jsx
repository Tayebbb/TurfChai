import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import {
  approveOwnerBooking,
  cancelOwnerBooking,
  getOwnerBookings,
  refundOwnerBooking,
} from '@/api/ownerBookings';
import { listMyVenues } from '@/api/ownerVenues';
import { getMyTurfRequests } from '@/api/turfRequests';
import { paths } from '@/routes/paths';
import { toUserMessage } from '@/utils/errorMessage';

const PAGE_SIZE = 20;

const ACTION_HANDLERS = {
  approve: { run: approveOwnerBooking, done: 'Booking approved ✓' },
  cancel: { run: cancelOwnerBooking, done: 'Booking cancelled — slot released' },
  refund: { run: refundOwnerBooking, done: 'Refund recorded per your cancellation policy' },
};

export default function BookingsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['Today']);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // One in-flight action per row: a second click must not fire a second write.
  const [busyId, setBusyId] = useState(null);

  const { data: res, loading, reload } = useApi(getOwnerBookings, []);
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
  const matching = term
    ? bookings.filter((row) =>
        `${row.customer} ${row.sub} ${row.bookingCode} ${row.pitch}`.toLowerCase().includes(term),
      )
    : bookings;

  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = matching.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const runAction = async (row, action) => {
    const handler = ACTION_HANDLERS[action];
    if (!handler || busyId != null) return;
    setBusyId(row.id);
    try {
      await handler.run(row.id);
      showToast(handler.done);
      reload();
    } catch (error) {
      showToast(toUserMessage(error, 'Could not complete that action.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageTitle title="Bookings" />

      <div className="main-header">
        <div>
          <h1>Bookings</h1>
          <span className="subtle small">All sources · searchable &amp; filterable ({pitchCount} Pitch{pitchCount > 1 ? 'es' : ''})</span>
        </div>
        <Button variant="primary" to={paths.owner.calendar}>
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

      <TableScroll label="Bookings" className="card" style={{ padding: 0 }}>
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
              <tr key={row.id} style={row.dim ? { background: 'var(--surface-2)' } : undefined}>
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
                  {row.actions?.length ? (
                    <div className="row" style={{ gap: 6 }}>
                      {row.actions.map((action) => (
                        <Button
                          key={action.label}
                          size="sm"
                          variant={action.variant}
                          disabled={busyId != null}
                          onClick={() => runAction(row, action.action)}
                        >
                          {busyId === row.id ? 'Working…' : action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
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
      </TableScroll>
      <div className="between small" style={{ marginTop: 10 }}>
        <span className="subtle">
          Showing {visible.length} of {matching.length} booking{matching.length === 1 ? '' : 's'}
          {totalPages > 1 ? ` · page ${safePage + 1} of ${totalPages}` : ''}
        </span>
        <div className="row">
          <Button
            size="sm"
            variant="tertiary"
            disabled={safePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            ‹ Prev
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
          >
            Next ›
          </Button>
        </div>
      </div>
    </>
  );
}