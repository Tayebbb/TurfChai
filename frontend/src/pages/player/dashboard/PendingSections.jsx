import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { paths } from '@/routes/paths';
import { listBookings, formatBookingDate, formatTimeRange } from '@/api/bookings';
import { getNotifications, markAllRead, markRead } from '@/api/notifications';
import { getWalletHistory } from '@/api/rewards';
import { getMyStats } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { formatBdt } from '@/utils/format';
import { DashCard, DashEmpty, DashError, DashHeader, DashSkeleton } from './DashboardKit';

export function BookingsSection() {
  const { data: bookings, loading, error, reload } = useApi(listBookings, []);
  const bookingList = Array.isArray(bookings) ? bookings : [];

  return (
    <>
      <DashHeader title="My bookings" subtitle="Upcoming, past and cancelled turf bookings." />

      {loading ? (
        <DashSkeleton rows={3} />
      ) : error ? (
        <DashError message={toUserMessage(error, 'Could not load your bookings.')} onRetry={reload} />
      ) : bookingList.length === 0 ? (
        <DashEmpty
          icon="📅"
          title="No bookings yet"
          actions={
            <Button size="sm" to={paths.player.explore}>
              Explore turfs & book a slot
            </Button>
          }
        >
          When you book pitches across Dhaka, your slot details, confirmation codes and check-in QR codes will appear here.
        </DashEmpty>
      ) : (
        <div className="dash-rows">
          {bookingList.map((booking, index) => {
            // The detail route is keyed on the numeric id. A booking without
            // one cannot be linked to, so it renders as a plain row instead of
            // producing `/player/bookings/undefined`.
            const detailId = booking?.id ?? null;
            const key = detailId ?? booking?.bookingCode ?? `booking-${index}`;
            const body = (
              <>
                <div className="dash-row-main">
                  <b>{booking?.venueName || 'Turf booking'}</b>
                  <span>
                    {formatBookingDate(booking)} · {formatTimeRange(booking?.startTime, booking?.endTime)}
                  </span>
                </div>
                <Badge tone={booking?.status === 'CONFIRMED' ? 'green' : 'gray'}>
                  {booking?.status || 'PENDING'}
                </Badge>
              </>
            );

            return detailId == null ? (
              <div key={key} className="dash-row">
                {body}
              </div>
            ) : (
              <Link key={key} className="dash-row" to={paths.player.bookingDetail(detailId)}>
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export function StatsSection() {
  const { data, loading, error, reload } = useApi(getMyStats, []);

  if (loading) {
    return (
      <>
        <DashHeader title="Statistics" subtitle="Your bookings, check-ins and reliability." />
        <DashSkeleton rows={3} />
      </>
    );
  }
  if (error) {
    return (
      <>
        <DashHeader title="Statistics" subtitle="Your bookings, check-ins and reliability." />
        <DashError message={toUserMessage(error, 'Could not load your statistics.')} onRetry={reload} />
      </>
    );
  }

  const stats = data ?? {};
  const months = Array.isArray(stats.bookingsByMonth) ? stats.bookingsByMonth : [];
  const busiest = months.reduce((max, month) => Math.max(max, month.bookings ?? 0), 0);

  if ((stats.totalBookings ?? 0) === 0) {
    return (
      <>
        <DashHeader title="Statistics" subtitle="Your bookings, check-ins and reliability." />
        <DashEmpty
          icon="📈"
          title="Nothing to measure yet"
          actions={
            <Button size="sm" to={paths.player.explore}>
              Book your first slot
            </Button>
          }
        >
          Your booking count, attendance and favourite venue appear here once you have played a game.
        </DashEmpty>
      </>
    );
  }

  return (
    <>
      <DashHeader title="Statistics" subtitle="Your bookings, check-ins and reliability." />

      <div className="grid4" style={{ gap: 12 }}>
        <StatTile label="Bookings" value={stats.totalBookings} />
        <StatTile label="Played" value={stats.completedBookings} />
        <StatTile label="Upcoming" value={stats.upcomingBookings} />
        <StatTile label="Cancelled" value={stats.cancelledBookings} />
      </div>

      <div className="grid4" style={{ gap: 12, marginTop: 12 }}>
        <StatTile label="Checked in" value={stats.checkedInCount} />
        <StatTile label="Venues played" value={stats.venuesPlayed} />
        <StatTile label="Open games" value={stats.openGamesJoined} />
        <StatTile label="Reviews" value={stats.reviewsWritten} />
      </div>

      <DashCard title="Reliability" style={{ marginTop: 12 }}>
        <div className="between">
          <span className="subtle small">Attendance score used by open-game hosts</span>
          <b className="num">{stats.reliabilityScore}%</b>
        </div>
      </DashCard>

      <DashCard title="Spend & favourites" style={{ marginTop: 12 }}>
        <div className="between small">
          <span className="muted">Total spent</span>
          <b className="num">{formatBdt(stats.totalSpent ?? 0)}</b>
        </div>
        <div className="between small" style={{ marginTop: 6 }}>
          <span className="muted">Most-booked venue</span>
          <b>{stats.favouriteVenueName ?? '—'}</b>
        </div>
      </DashCard>

      {months.length > 0 ? (
        <DashCard title="Bookings by month" style={{ marginTop: 12 }}>
          <div className="stack-sm">
            {months.map((month) => (
              <div key={month.month} className="between small">
                <span className="muted">{month.month}</span>
                <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--brand)',
                      width: busiest > 0 ? `${Math.round((month.bookings / busiest) * 120)}px` : 0,
                    }}
                  />
                  <b className="num">{month.bookings}</b>
                </span>
              </div>
            ))}
          </div>
        </DashCard>
      ) : null}

      <p className="tiny subtle" style={{ marginTop: 10 }}>
        TurfChai does not record match scores, so wins and losses are not shown.
      </p>
    </>
  );
}

function StatTile({ label, value }) {
  return (
    <Panel>
      <div className="tiny subtle">{label}</div>
      <b className="num" style={{ fontSize: 22 }}>
        {value ?? 0}
      </b>
    </Panel>
  );
}

export function WalletSection() {
  const { data, loading, error, reload } = useApi(getWalletHistory, []);
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <>
      <DashHeader title="Wallet" subtitle="Your TurfChai credit and where it came from." />

      {loading ? (
        <DashSkeleton rows={3} />
      ) : error ? (
        <DashError message={toUserMessage(error, 'Could not load your wallet.')} onRetry={reload} />
      ) : (
        <>
          <DashCard title="Balance">
            <div className="between">
              <span className="subtle small">Applied automatically at checkout</span>
              <b className="num" style={{ fontSize: 24 }}>
                {formatBdt(data?.balance ?? 0)}
              </b>
            </div>
          </DashCard>

          {entries.length === 0 ? (
            <DashEmpty
              icon="৳"
              title="No wallet activity yet"
              actions={
                <Button size="sm" to={paths.player.rewards}>
                  Redeem points for credit
                </Button>
              }
            >
              Reward redemptions and refunds land here, and the balance is offered at checkout.
            </DashEmpty>
          ) : (
            <div className="dash-rows" style={{ marginTop: 12 }}>
              {entries.map((entry) => (
                <div className="dash-row" key={entry.id}>
                  <div className="dash-row-main">
                    <b>{entry.label}</b>
                    <span>
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''}
                      {entry.bookingId ? ` · booking #${entry.bookingId}` : ''}
                    </span>
                  </div>
                  <b
                    className="num"
                    style={{ color: Number(entry.delta) >= 0 ? 'var(--brand-600)' : 'var(--danger)' }}
                  >
                    {Number(entry.delta) >= 0 ? '+' : '−'}
                    {formatBdt(Math.abs(Number(entry.delta ?? 0)))}
                  </b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function NotificationsSection() {
  const { data: notifData, loading, error, reload } = useApi(getNotifications, []);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const notificationsList = Array.isArray(notifData) ? notifData : [];
  const hasUnread = notificationsList.some((item) => !item?.isRead);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      reload();
    } catch (e) {
      showToast(toUserMessage(e, 'Could not mark these as read.'));
    }
  };

  const openNotification = async (item) => {
    if (!item?.isRead) {
      try {
        await markRead(item.id);
        reload();
      } catch (e) {
        showToast(toUserMessage(e, 'Could not mark that notification as read.'));
        return;
      }
    }
    if (item?.link) {
      navigate(item.link);
    }
  };

  return (
    <>
      <DashHeader
        title="Notifications"
        subtitle="Reminders, invitations and announcements."
        action={hasUnread ? (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleMarkAllRead}>
            Mark all read
          </button>
        ) : null}
      />

      {loading ? (
        <DashSkeleton rows={3} />
      ) : error ? (
        <DashError message={toUserMessage(error, 'Could not load your notifications.')} onRetry={reload} />
      ) : notificationsList.length === 0 ? (
        <DashCard>
          <DashEmpty icon="🔔" title="All caught up!">
            You do not have any notifications right now.
          </DashEmpty>
        </DashCard>
      ) : (
        <div className="stack-sm">
          {notificationsList.map((item, index) => (
            <button
              key={item?.id ?? `notification-${index}`}
              type="button"
              className="notif-item"
              aria-label={`${item?.title ?? 'Notification'}${item?.isRead ? '' : ', unread'}`}
              onClick={() => openNotification(item)}
            >
              <Panel style={{ opacity: item?.isRead ? 0.6 : 1 }}>
                <b>{item?.title ?? 'Notification'}</b>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {item?.body}
                </p>
                <span className="tiny subtle">
                  {item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </span>
              </Panel>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
