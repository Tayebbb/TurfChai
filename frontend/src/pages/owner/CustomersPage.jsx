import { useState, useMemo } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import {
  getOwnerCustomers,
  updateCustomerNote,
  rewardCustomer,
  rewardRegularCustomers,
} from '@/api/ownerCustomers';
import { toUserMessage } from '@/utils/errorMessage';

const FILTERS = ['All', 'Regulars (4+ visits)', 'VIPs (10+ visits)', 'Has no-shows'];

function matchesFilter(row, filter) {
  if (filter === 'All') return true;
  const visits = Number(row.confirmedVisits ?? 0);
  if (filter === 'Regulars (4+ visits)') return visits >= 4;
  if (filter === 'VIPs (10+ visits)') return visits >= 10;
  if (filter === 'Has no-shows') return Number(row.noShows ?? 0) > 0;
  return true;
}

export default function CustomersPage() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState('All');
  const [query, setQuery] = useState('');

  // Note Modal state
  const [noteCustomer, setNoteCustomer] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Reward Modals & actions
  const [rewardSingleTarget, setRewardSingleTarget] = useState(null);
  const [showRewardAllModal, setShowRewardAllModal] = useState(false);
  const [rewarding, setRewarding] = useState(false);

  const { data: res, loading } = useApi(getOwnerCustomers, []);
  const [localCustomers, setLocalCustomers] = useState(null);

  const customers = useMemo(() => {
    if (localCustomers) return localCustomers;
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }, [res, localCustomers]);

  const term = query.trim().toLowerCase();
  const visible = customers
    .filter((row) => (term ? `${row.name} ${row.phone}`.toLowerCase().includes(term) : true))
    .filter((row) => matchesFilter(row, activeFilter));

  const regularCustomers = customers.filter((row) => Number(row.confirmedVisits ?? 0) >= 4);

  const handleOpenNoteModal = (customer) => {
    setNoteCustomer(customer);
    setNoteText(customer.note || '');
  };

  const handleSaveNote = async () => {
    if (!noteCustomer) return;
    try {
      setSavingNote(true);
      await updateCustomerNote(noteCustomer.id, noteText);
      // Update local state immediately
      setLocalCustomers(
        customers.map((c) => (c.id === noteCustomer.id ? { ...c, note: noteText } : c)),
      );
      showToast(`Note updated for ${noteCustomer.name}`);
      setNoteCustomer(null);
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to update note'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleRewardSingle = async () => {
    if (!rewardSingleTarget) return;
    try {
      setRewarding(true);
      const res = await rewardCustomer(rewardSingleTarget.id);
      showToast(res?.message || `10% off coupon emailed to ${rewardSingleTarget.name}!`);
      setRewardSingleTarget(null);
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to reward customer'));
    } finally {
      setRewarding(false);
    }
  };

  const handleRewardAll = async () => {
    try {
      setRewarding(true);
      const res = await rewardRegularCustomers();
      showToast(res?.message || '10% off coupon emailed to all regular customers!');
      setShowRewardAllModal(false);
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to reward regular customers'));
    } finally {
      setRewarding(false);
    }
  };

  return (
    <>
      <PageTitle title="Customers" />

      <div className="main-header">
        <div>
          <h1>Customers</h1>
          <span className="subtle small">Every player and team who has booked with you</span>
        </div>
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
          <Chip
            key={filter}
            active={activeFilter === filter}
            onToggle={() => setActiveFilter(filter)}
          >
            {filter}
          </Chip>
        ))}
      </div>

      {loading ? (
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="center subtle small" style={{ padding: '48px 0' }}>
                  Loading customers…
                </td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
      ) : visible.length > 0 ? (
        <>
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
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const isRegular = Number(row.confirmedVisits ?? 0) >= 4;
                  return (
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
                      <td
                        className="num"
                        style={row.noShowsDanger ? { color: 'var(--danger)' } : undefined}
                      >
                        {row.noShows}
                      </td>
                      <td>
                        {row.note && row.note.trim().length > 0 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenNoteModal(row)}
                            title={`Note: ${row.note}`}
                          >
                            📝 Show note
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="tertiary"
                            onClick={() => handleOpenNoteModal(row)}
                            title="Add note for this customer"
                          >
                            📝 Add note
                          </Button>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={isRegular ? 'primary' : 'secondary'}
                          onClick={() => setRewardSingleTarget(row)}
                          title={`Send 10% off reward coupon to ${row.name}`}
                        >
                          🎁 Reward 10%
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>

          <Alert
            tone="info"
            icon="🎁"
            title="Reward your regulars & customers"
            style={{ marginTop: 14, alignItems: 'center' }}
          >
            <div className="between" style={{ width: '100%', flexWrap: 'wrap', gap: 12 }}>
              <span>
                {regularCustomers.length > 0
                  ? `You have ${regularCustomers.length} regular/VIP customer${regularCustomers.length > 1 ? 's' : ''}. Send them an exclusive 10% off coupon directly to their email.`
                  : 'Send exclusive 10% off reward coupons directly to your players’ registered emails.'}
              </span>
              {regularCustomers.length > 0 ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowRewardAllModal(true)}
                >
                  🎁 Send 10% off coupon to all regulars ({regularCustomers.length})
                </Button>
              ) : null}
            </div>
          </Alert>
        </>
      ) : (
        <div className="card" style={{ padding: '48px 24px' }}>
          <EmptyState
            glyph={query ? '🔍' : '👥'}
            title={
              query
                ? `No customers matching "${query}"`
                : activeFilter !== 'All'
                  ? `No customers in "${activeFilter}"`
                  : 'No customers found'
            }
            description={
              query || activeFilter !== 'All'
                ? 'Try adjusting your search terms or resetting active filters.'
                : 'Customers will appear here automatically when players book matches at your venues.'
            }
            action={
              (query || activeFilter !== 'All') && (
                <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {query && (
                    <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  )}
                  {activeFilter !== 'All' && (
                    <Button size="sm" variant="tertiary" onClick={() => setActiveFilter('All')}>
                      Reset filter ({activeFilter})
                    </Button>
                  )}
                </div>
              )
            }
            style={{ border: 'none', padding: 0 }}
          />
        </div>
      )}

      {/* Customer Note Modal */}
      {noteCustomer && (
        <Overlay
          isOpen={true}
          onClose={() => setNoteCustomer(null)}
          title={`Note for ${noteCustomer.name}`}
          maxWidth={460}
        >
          <div style={{ marginBottom: 14 }}>
            <span className="subtle small">
              {noteCustomer.phone} · {noteCustomer.bookings} booking{noteCustomer.bookings === 1 ? '' : 's'} · {noteCustomer.spend} spend
            </span>
          </div>
          <Field label="Private Note" help="Only visible to you and your venue management team.">
            <textarea
              className="input"
              rows={4}
              placeholder="e.g. Captain of Thunder FC, prefers weekend evening slots, pays on arrival..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
              autoFocus
            />
          </Field>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={savingNote}
              onClick={() => setNoteCustomer(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={savingNote}
              onClick={handleSaveNote}
            >
              {savingNote ? 'Saving…' : 'Save note'}
            </Button>
          </div>
        </Overlay>
      )}

      {/* Reward Single Customer Modal */}
      {rewardSingleTarget && (
        <Overlay
          isOpen={true}
          onClose={() => setRewardSingleTarget(null)}
          title="Reward Regular Customer"
          maxWidth={460}
        >
          <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Send a <strong>10% off discount coupon</strong> to <strong>{rewardSingleTarget.name}</strong> ({rewardSingleTarget.phone})?
          </p>
          <p className="subtle small" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
            This will mail an exclusive 10% coupon code (<code>LOYAL10</code>) to their registered email and send them an in-app reward notification.
          </p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={rewarding}
              onClick={() => setRewardSingleTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={rewarding}
              onClick={handleRewardSingle}
            >
              {rewarding ? 'Sending…' : '🎁 Send 10% coupon'}
            </Button>
          </div>
        </Overlay>
      )}

      {/* Reward All Regulars Modal */}
      {showRewardAllModal && (
        <Overlay
          isOpen={true}
          onClose={() => setShowRewardAllModal(false)}
          title="Reward All Regular Customers"
          maxWidth={480}
        >
          <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Send a <strong>10% off discount coupon</strong> to all <strong>{regularCustomers.length} regular &amp; VIP customers</strong>?
          </p>
          <p className="subtle small" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
            Each player with 4+ confirmed visits will receive the 10% off coupon code (<code>LOYAL10</code>) via email and notification.
          </p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={rewarding}
              onClick={() => setShowRewardAllModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={rewarding}
              onClick={handleRewardAll}
            >
              {rewarding ? 'Sending…' : `🎁 Send 10% coupon to ${regularCustomers.length} players`}
            </Button>
          </div>
        </Overlay>
      )}
    </>
  );
}