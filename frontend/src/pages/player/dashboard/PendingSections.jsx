import { Link } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { paths } from '@/routes/paths';
import { listBookings, formatBookingDate, formatTimeRange } from '@/api/bookings';
import { getNotifications, markAllRead } from '@/api/notifications';
import { useApi } from '@/hooks/useApi';
import { DashCard, DashEmpty, DashError, DashHeader, DashSkeleton, ServicePending } from './DashboardKit';

export function BookingsSection() {
  const { data: bookings, loading, error, reload } = useApi(listBookings, []);
  const bookingList = Array.isArray(bookings) ? bookings : [];

  return (
    <>
      <DashHeader title="My bookings" subtitle="Upcoming, past and cancelled turf bookings." />

      {loading ? (
        <DashSkeleton rows={3} />
      ) : error ? (
        <DashError message="Could not load your bookings." onRetry={reload} />
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
          {bookingList.map((booking) => (
            <Link
              key={booking.id || booking.referenceCode}
              className="dash-row"
              to={paths.player.booking(booking.id || booking.referenceCode)}
            >
              <div className="dash-row-main">
                <b>{booking.venueName || 'Turf Booking'}</b>
                <span>
                  {formatBookingDate(booking)} · {formatTimeRange(booking.startTime, booking.endTime)}
                </span>
              </div>
              <Badge tone={booking.status === 'CONFIRMED' ? 'green' : 'gray'}>
                {booking.status || 'CONFIRMED'}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function TeamsSection() {
  return (
    <>
      <DashHeader title="My teams" subtitle="Teams you own, teams you’ve joined and squad invites." />
      <ServicePending
        icon="👥"
        title="Teams & Squads"
        description="Build persistent team squads, invite players, manage pitch rosters, and track win streaks."
        cta={
          <Button size="sm" to={paths.player.dashboard.tournaments}>
            See tournament squads
          </Button>
        }
      />
    </>
  );
}

export function NetworkSection() {
  return (
    <>
      <DashHeader
        title="Player network"
        subtitle="People you’ve played with and who to invite next."
      />
      <ServicePending
        icon="🤝"
        title="Player Network"
        description="Connect with recently-played teammates, view match attendance records, and invite players to your next game."
        cta={
          <Button size="sm" to={paths.solo.openGames}>
            Find open games
          </Button>
        }
      />
    </>
  );
}

export function StatsSection() {
  return (
    <>
      <DashHeader title="Statistics" subtitle="Matches, hours played, streaks and win rate." />
      <ServicePending
        icon="📈"
        title="Player Statistics"
        description="Track your completed matches, total play time, attendance reliability, and performance metrics across all Dhaka venues."
        cta={
          <Button size="sm" to={paths.player.explore}>
            Explore turfs
          </Button>
        }
      />
    </>
  );
}

export function WalletSection() {
  return (
    <>
      <DashHeader title="Wallet & payments" subtitle="Transactions, refunds and invoices." />
      <ServicePending
        icon="৳"
        title="Wallet & Payment History"
        description="View your digital pitch receipts, split-payment breakdowns, transaction histories, and active refunds."
        cta={
          <Button size="sm" to={paths.player.explore}>
            Explore venues
          </Button>
        }
      />
    </>
  );
}

export function NotificationsSection() {
  const { data: notifData, loading, error, reload } = useApi(getNotifications, []);
  const notificationsList = notifData || [];

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <DashHeader 
        title="Notifications" 
        subtitle="Reminders, invitations and announcements." 
        action={notificationsList.some(n => !n.isRead) ? (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleMarkAllRead}>
            Mark all read
          </button>
        ) : null}
      />
      {loading && <div style={{ padding: 40 }} className="center">Loading notifications...</div>}
      {error && <div style={{ padding: 40, color: 'var(--danger)' }} className="center">Failed to load notifications</div>}
      
      {!loading && !error && notificationsList.length === 0 ? (
        <DashCard>
          <DashEmpty
            icon="🔔"
            title="All caught up!"
            description="You don't have any notifications right now."
          />
        </DashCard>
      ) : (
        <div className="stack-sm">
          {notificationsList.map((item) => (
            <Panel key={item.id} style={{ opacity: item.isRead ? 0.6 : 1 }}>
              <b>{item.title}</b>
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {item.body}
              </p>
              <span className="tiny subtle">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
              </span>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
