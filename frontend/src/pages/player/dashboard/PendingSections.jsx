import { Button } from '@/components/buttons/Button';
import { Panel } from '@/components/ui/Panel';
import { paths } from '@/routes/paths';
import { getNotifications, markAllRead } from '@/api/notifications';
import { useApi } from '@/hooks/useApi';
import { DashHeader, ServicePending } from './DashboardKit';

/**
 * Sections whose backing service does not exist yet. They state exactly which
 * endpoint is missing rather than rendering invented bookings, payments or
 * notifications — fake data here would be indistinguishable from real data.
 */

export function BookingsSection() {
  return (
    <>
      <DashHeader title="My bookings" subtitle="Upcoming, past and cancelled turf bookings." />
      <ServicePending
        icon="📅"
        title="Bookings aren’t connected yet"
        description="Slot availability, reservations, invoices and cancellations all come from the booking service, which is still being built."
        endpoints={['GET /api/v1/bookings', 'POST /api/v1/bookings', 'DELETE /api/v1/bookings/{id}']}
        owner="booking engine"
        cta={
          <Button size="sm" to={paths.player.explore}>
            Browse venues meanwhile
          </Button>
        }
      />
    </>
  );
}

export function TeamsSection() {
  return (
    <>
      <DashHeader title="My teams" subtitle="Teams you own, teams you’ve joined and invitations." />
      <ServicePending
        icon="👥"
        title="Teams aren’t connected yet"
        description="Persistent squads, rosters, invitations and team statistics need the team service. Tournament squads you register are shown under Tournaments."
        endpoints={['GET /api/v1/teams', 'POST /api/v1/teams', 'GET /api/v1/teams/invitations']}
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
        subtitle="People you’ve played with, and who to invite next."
      />
      <ServicePending
        icon="🤝"
        title="Your network isn’t connected yet"
        description="Recently-played-with players are derived from completed matches, so this needs both the booking service and the open-games attendance records."
        endpoints={['GET /api/v1/players/me/network', 'GET /api/v1/bookings/{id}/participants']}
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
        title="Statistics aren’t available yet"
        description="Every figure here is aggregated from completed bookings and match results, so the charts stay empty until those services land. Your reliability score is already on your profile."
        endpoints={['GET /api/v1/players/me/stats']}
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
        title="Payments aren’t connected yet"
        description="Balances, transaction history, refunds and downloadable invoices all come from the payments service. Tournament entry fees currently show as due and are settled with the organiser."
        endpoints={['GET /api/v1/payments', 'GET /api/v1/payments/{id}/invoice', 'GET /api/v1/wallet']}
        owner="payments module"
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
      {loading && <div style={{padding:40}} className="center">Loading notifications...</div>}
      {error && <div style={{padding:40, color:'var(--danger)'}} className="center">Failed to load notifications</div>}
      
      {!loading && !error && notificationsList.length === 0 ? (
        <ServicePending
          icon="🔔"
          title="All caught up!"
          description="You don't have any notifications right now."
        />
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
