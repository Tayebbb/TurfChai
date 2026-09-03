import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { ManualBookingModal } from '@/components/modals/ManualBookingModal';
import { Overlay } from '@/components/modals/Overlay';
import { useDisclosure } from '@/hooks/useDisclosure';
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
import { toUserMessage } from '@/utils/errorMessage';

const PAGE_SIZE = 20;

const ACTION_HANDLERS = {
  approve: { run: approveOwnerBooking, done: 'Booking approved ✓' },
  cancel: { run: cancelOwnerBooking, done: 'Booking cancelled — slot released' },
  refund: { run: refundOwnerBooking, done: 'Refund recorded per your cancellation policy' },
};

export default function BookingsPage() {
  const { showToast } = useToast();
  const manualBookingModal = useDisclosure(false);
  const [activeFilter, setActiveFilter] = useState('Today');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // One in-flight action per row: a second click must not fire a second write.
  const [busyId, setBusyId] = useState(null);
  const [confirmRefundRow, setConfirmRefundRow] = useState(null);
  const [confirmCancelRow, setConfirmCancelRow] = useState(null);

  const { data: res, loading, reload } = useApi(getOwnerBookings, []);
  const rawBookings = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  // "Phone vs Walk-in" used to be invented from booking-code parity — a
  // fabricated fact the filters then filtered on. The server does not expose
  // the distinction, so offline/manual bookings stay labelled as they arrive.
  const bookings = rawBookings;

  const { data: venuesRes } = useApi(listMyVenues, []);
  const venues = Array.isArray(venuesRes) ? venuesRes : (Array.isArray(venuesRes?.data) ? venuesRes.data : []);
  const activeVenue = Array.isArray(venues) && venues.length > 0 ? venues[0] : null;

  const { data: requestsRes } = useApi(getMyTurfRequests, []);
  const latestRequest = Array.isArray(requestsRes) ? requestsRes[0] : null;

  const pitchCount = activeVenue?.pitchCount || activeVenue?.pitches?.length || latestRequest?.pitchCount || 1;
  const pitchFilters = Array.from({ length: pitchCount }, (_, i) => `Pitch ${i + 1}`);

  const filters = [
    'All',
    'Today',
    'This week',
    ...pitchFilters,
    'Online',
    'Manual / phone / walk-in',
    'Payment pending',
  ];

  const term = query.trim().toLowerCase();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const mondayStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const sundayStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

  const matchesFilter = (row) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Today') {
      return row.bookingDate === todayStr;
    }
    if (activeFilter === 'This week') {
      if (!row.bookingDate) return false;
      return row.bookingDate >= mondayStr && row.bookingDate <= sundayStr;
    }
    if (activeFilter.startsWith('Pitch ')) {
      return (row.pitch || '').toLowerCase().includes(activeFilter.toLowerCase());
    }
    if (activeFilter === 'Online') {
      return row.source?.text === 'Online' || (!String(row.source?.text || '').toLowerCase().includes('walk') && !String(row.source?.text || '').toLowerCase().includes('phone'));
    }
    if (activeFilter === 'Manual / phone / walk-in') {
      return String(row.source?.text || '').toLowerCase().includes('phone')
        || String(row.source?.text || '').toLowerCase().includes('walk')
        || String(row.bookingCode || '').startsWith('MB-');
    }
    if (activeFilter === 'Payment pending') {
      return (row.payment?.tone === 'amber' || row.status === 'PENDING' || (row.payment?.text || '').toLowerCase().includes('pending'));
    }
    return true;
  };

  const matching = bookings
    .filter((row) => (!term || `${row.customer} ${row.sub} ${row.bookingCode} ${row.pitch}`.toLowerCase().includes(term)))
    .filter(matchesFilter);

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

  const handleActionClick = (row, action) => {
    if (action === 'refund') {
      setConfirmRefundRow(row);
      return;
    }
    // Cancelling frees a player's slot — destructive, so it confirms first,
    // exactly like refund. It used to fire with zero protection.
    if (action === 'cancel') {
      setConfirmCancelRow(row);
      return;
    }
    runAction(row, action);
  };

  const getEmptyState = () => {
    if (term) {
      return {
        glyph: '🔍',
        title: `No bookings matching "${query}"`,
        description: activeFilter !== 'All'
          ? `No matching bookings under filter "${activeFilter}". Try clearing your search or resetting filters.`
          : 'Try adjusting your search terms or resetting active filters.',
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
            {activeFilter !== 'All' && (
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => {
                  setActiveFilter('All');
                  setPage(0);
                }}
              >
                Reset filter ({activeFilter})
              </Button>
            )}
          </div>
        ),
      };
    }

    if (activeFilter === 'Payment pending') {
      return {
        glyph: '💳',
        title: 'No pending payments',
        description: 'All current bookings are settled or paid. Any bookings awaiting customer payment will appear here.',
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              View all bookings
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    if (activeFilter === 'Today') {
      return {
        glyph: '📅',
        title: 'No bookings scheduled for today',
        description: 'There are no match slots booked for today yet.',
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              View all bookings
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    if (activeFilter === 'This week') {
      return {
        glyph: '🗓️',
        title: 'No bookings this week',
        description: 'No match slots found for the current week.',
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              View all bookings
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    if (activeFilter.startsWith('Pitch ')) {
      return {
        glyph: '⚽',
        title: `No bookings on ${activeFilter}`,
        description: `There are currently no matches scheduled on ${activeFilter}.`,
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              View all bookings
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    if (activeFilter === 'Online') {
      return {
        glyph: '🌐',
        title: 'No online bookings found',
        description: 'Bookings made online by players will show up here.',
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              Reset filter
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    if (activeFilter === 'Phone' || activeFilter === 'Walk-in') {
      return {
        glyph: activeFilter === 'Phone' ? '📞' : '🚶',
        title: `No ${activeFilter.toLowerCase()} bookings found`,
        description: `Manual bookings recorded as ${activeFilter.toLowerCase()} will appear here.`,
        action: (
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveFilter('All');
                setPage(0);
              }}
            >
              Reset filter
            </Button>
            <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
              + Manual booking
            </Button>
          </div>
        ),
      };
    }

    return {
      glyph: '⚽',
      title: 'No bookings found',
      description: 'You haven’t recorded any bookings yet. Create a manual booking or wait for players to book online.',
      action: (
        <Button size="sm" variant="primary" onClick={manualBookingModal.open}>
          + Manual booking
        </Button>
      ),
    };
  };

  const emptyState = getEmptyState();

  return (
    <>
      <PageTitle title="Bookings" />

      <div className="main-header">
        <div>
          <h1>Bookings</h1>
          <span className="subtle small">All sources · searchable &amp; filterable ({pitchCount} Pitch{pitchCount > 1 ? 'es' : ''})</span>
        </div>
        <Button variant="primary" onClick={manualBookingModal.open}>
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
          <Chip
            key={filter}
            active={activeFilter === filter}
            onToggle={() => {
              setActiveFilter(filter);
              setPage(0);
            }}
          >
            {filter}
          </Chip>
        ))}
      </div>

      {loading ? (
        <TableScroll label="Bookings" className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
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
              <tr>
                <td colSpan={9} className="center subtle small" style={{ padding: '48px 0' }}>
                  Loading bookings…
                </td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
      ) : visible.length > 0 ? (
        <>
          <TableScroll label="Bookings" className="card" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
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
                  <tr
                    key={row.id}
                    // Dimmed = past booking; the label carries the meaning,
                    // the fade only supports it (not color-only).
                    aria-label={row.dim ? 'Past booking' : undefined}
                    style={
                      row.dim
                        ? {
                            background: 'rgba(255, 255, 255, 0.02)',
                            opacity: 0.65,
                          }
                        : undefined
                    }
                  >
                    <td className="num small" style={{ whiteSpace: 'nowrap' }}>
                      {row.bookingDate ? new Date(row.bookingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Today'}
                    </td>
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
                              // Only this row locks; a write in flight elsewhere
                              // no longer disables every action in the table.
                              disabled={busyId === row.id}
                              onClick={() => handleActionClick(row, action.action)}
                            >
                              {busyId === row.id ? 'Working…' : action.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <div className="between small" style={{ marginTop: 10 }}>
            <span className="subtle">
              Showing {visible.length} of {matching.length} booking{matching.length === 1 ? '' : 's'}
              {totalPages > 1 ? ` · page ${safePage + 1} of ${totalPages}` : ''}
            </span>
            {totalPages > 1 ? (
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
            ) : null}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: '48px 24px' }}>
          <EmptyState
            glyph={emptyState.glyph}
            title={emptyState.title}
            description={emptyState.description}
            action={emptyState.action}
            style={{ border: 'none', padding: 0 }}
          />
        </div>
      )}

      {confirmRefundRow && (
        <Overlay
          isOpen={true}
          onClose={() => setConfirmRefundRow(null)}
          title="Confirm refund"
          maxWidth={440}
        >
          <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Are you sure you want to cancel and refund booking <strong>{confirmRefundRow.bookingCode}</strong> for <strong>{confirmRefundRow.customer}</strong> ({confirmRefundRow.amountFormatted})?
          </p>
          <p className="subtle small" style={{ margin: '0 0 20px' }}>
            This will release the slot back to available and record the refund per your venue's cancellation policy.
          </p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId != null}
              onClick={() => setConfirmRefundRow(null)}
            >
              Keep booking
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busyId != null}
              onClick={async () => {
                const target = confirmRefundRow;
                setConfirmRefundRow(null);
                await runAction(target, 'refund');
              }}
            >
              {busyId === confirmRefundRow.id ? 'Refunding…' : 'Yes, refund booking'}
            </Button>
          </div>
        </Overlay>
      )}

      {confirmCancelRow && (
        <Overlay
          isOpen={true}
          onClose={() => setConfirmCancelRow(null)}
          title="Confirm cancellation"
          maxWidth={440}
        >
          <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Cancel booking <strong>{confirmCancelRow.bookingCode}</strong> for <strong>{confirmCancelRow.customer}</strong> ({confirmCancelRow.amountFormatted})?
          </p>
          <p className="subtle small" style={{ margin: '0 0 20px' }}>
            The slot is released back to available immediately and the player is notified.
          </p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId != null}
              onClick={() => setConfirmCancelRow(null)}
            >
              Keep booking
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busyId != null}
              onClick={async () => {
                const target = confirmCancelRow;
                setConfirmCancelRow(null);
                await runAction(target, 'cancel');
              }}
            >
              Yes, cancel booking
            </Button>
          </div>
        </Overlay>
      )}

      <ManualBookingModal
        isOpen={manualBookingModal.isOpen}
        onClose={manualBookingModal.close}
        onSuccess={reload}
        initialVenueId={activeVenue?.id}
      />
    </>
  );
}