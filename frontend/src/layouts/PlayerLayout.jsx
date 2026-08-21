import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { HeldSlotBanner } from '@/components/booking/HeldSlotBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { PLAYER_BOTTOM_NAV, PLAYER_NAV_LINKS } from '@/constants/navigation';
import { getNotifications, getUnreadCount, markAllRead, markRead } from '@/api/notifications';
import { clearSession } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useBodyClass } from '@/hooks/useBodyClass';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';

/**
 * Shell for every player, solo and host-tool screen: glass topbar,
 * mobile bottom nav, shared notification drawer and profile sheet.
 */
export function PlayerLayout({ withFooter = false }) {
  const notifications = useDisclosure(false);
  const profile = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  useBodyClass('has-bottomnav');

  // The shell renders on public routes too. Anything that identifies the
  // caller must stay unfetched until there is a real session, otherwise a
  // signed-out visitor either sees somebody else's identity or gets bounced
  // by the 401 handler while browsing a public page.
  const { signedIn, role, user: player, loading: profileLoading, error: profileError, reload: reloadProfile } =
    useSession();

  const isOwnerOrAdmin = signedIn && (role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN');

  const handleExitPlayerView = () => {
    if (location.state?.returnTo) {
      navigate(location.state.returnTo);
    } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      navigate(paths.admin.dashboard);
    } else {
      navigate(paths.owner.venueSetup);
    }
  };

  const { data: notifData, reload: reloadNotifs } = useApi(
    () => (signedIn ? getNotifications() : Promise.resolve([])),
    [signedIn],
  );
  const { data: unreadData, reload: reloadUnread } = useApi(
    () => (signedIn ? getUnreadCount() : Promise.resolve(null)),
    [signedIn],
  );

  const notificationsList = Array.isArray(notifData) ? notifData : [];
  const unreadCount = unreadData?.count ?? 0;

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      reloadNotifs();
      reloadUnread();
    } catch (e) {
      showToast(toUserMessage(e, 'Could not mark your notifications as read.'));
    }
  };

  // Opening one is what marks it read, and it takes the player to whatever it
  // is about — a notification you cannot act on is just an announcement.
  const openNotification = async (item) => {
    if (!item?.isRead) {
      try {
        await markRead(item.id);
        reloadNotifs();
        reloadUnread();
      } catch (e) {
        showToast(toUserMessage(e, 'Could not mark that notification as read.'));
        return;
      }
    }
    if (item?.link) {
      notifications.close();
      navigate(item.link);
    }
  };

  const fullName = signedIn ? player?.fullName || 'Player' : 'Guest';
  const initials = !signedIn
    ? '·'
    : (fullName ?? '').split(/\s+/).filter(Boolean).length === 1
      ? (fullName ?? '').trim().slice(0, 2).toUpperCase()
      : (fullName ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join('') || '·';

  const signOut = () => {
    clearSession();
    profile.close();
    navigate(paths.auth);
  };

  return (
    <>
      <HeldSlotBanner />
      <Topbar
        brand={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brand to={isOwnerOrAdmin ? paths.owner.venueSetup : paths.player.home} />
            {isOwnerOrAdmin && (
              <Badge tone="green" dot={false} style={{ fontSize: 11, fontWeight: 700 }}>
                👀 Turf Preview Mode
              </Badge>
            )}
          </div>
        }
        links={isOwnerOrAdmin ? [] : PLAYER_NAV_LINKS}
      >
        {isOwnerOrAdmin ? (
          <>
            <button
              type="button"
              onClick={handleExitPlayerView}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 9999,
                padding: '4px 10px',
                fontSize: 11.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                marginRight: 4,
                flexShrink: 0,
              }}
              title="Exit Player View and return to Owner portal"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900 }}>✕</span>
              <span>Exit Player View</span>
            </button>
            <ThemeToggle />
          </>
        ) : (
          <>
            <ThemeToggle />
            <IconButton
              label={`Notifications, ${unreadCount} unread`}
              notify={unreadCount > 0}
              onClick={notifications.open}
            >
              <span aria-hidden="true">🔔</span>
            </IconButton>
            <IconButton
              label="Profile menu"
              onClick={profile.open}
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand-600)',
                fontWeight: 700,
                border: 'none',
              }}
            >
              {initials}
            </IconButton>
          </>
        )}
      </Topbar>

      <RouteErrorBoundary>
        <Outlet />
      </RouteErrorBoundary>

      {withFooter && !isOwnerOrAdmin ? <SiteFooter /> : null}

      {!isOwnerOrAdmin && (
        <BottomNav
          links={PLAYER_BOTTOM_NAV}
          trailing={
            <button type="button" onClick={profile.open}>
              <span className="ico" aria-hidden="true">
                <Icon name="profile" />
              </span>
              Profile
            </button>
          }
        />
      )}

      <Overlay
        isOpen={notifications.isOpen}
        onClose={notifications.close}
        title="Notifications"
        mode="drawer"
      >
        <div className="between" style={{ padding: '0 16px', marginTop: 12 }}>
          <b style={{ fontSize: 18 }}>Notifications</b>
          {unreadCount > 0 && (
            <button type="button" className="btn btn-tertiary btn-sm" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>
        <div className="stack-sm" style={{ marginTop: 12, padding: '0 16px' }}>
          {notificationsList.length === 0 ? (
            <div className="subtle center" style={{ padding: '40px 0' }}>No notifications yet.</div>
          ) : (
            notificationsList.map((item) => (
              <button
                key={item.id}
                type="button"
                className="notif-item"
                aria-label={`${item.title}${item.isRead ? '' : ', unread'}`}
                onClick={() => openNotification(item)}
              >
                <Panel style={{ opacity: item.isRead ? 0.6 : 1 }}>
                  <b>{item.title}</b>
                  <p className="small muted" style={{ margin: '2px 0 0' }}>
                    {item.body}
                  </p>
                  <span className="tiny subtle">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </span>
                </Panel>
              </button>
            ))
          )}
        </div>
      </Overlay>

      <Overlay
        isOpen={profile.isOpen}
        onClose={profile.close}
        title="Profile menu"
        mode="sheet"
        hideHeader
        showGrabber
      >
        <div className="row" style={{ marginBottom: 16 }}>
          <Avatar name={player?.fullName ?? 'Guest'} initials={initials} size="lg" />
          <div style={{ minWidth: 0 }}>
            <b>{!signedIn ? 'Not signed in' : (player?.fullName ?? (profileLoading ? 'Loading…' : 'Your profile'))}</b>
            <div className="subtle">
              {!signedIn
                ? 'Sign in to see your bookings and profile'
                : [player?.phone, player?.area].filter(Boolean).join(' · ') ||
                  (profileError ? 'Profile unavailable — check your connection' : '\u00a0')}
            </div>
            {player ? (
              <div className="row-wrap" style={{ marginTop: 6 }}>
                {player.playStyle ? <Badge tone="green">{player.playStyle}</Badge> : null}
                {player.reliabilityScore != null ? (
                  <Badge tone="blue" dot={false}>
                    {player.reliabilityScore}% reliability
                  </Badge>
                ) : null}
                {player.gamesAttended ? (
                  <Badge tone="gray" dot={false}>
                    {player.gamesAttended} games
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {signedIn && profileError ? (
          <Button block variant="secondary" onClick={reloadProfile} style={{ marginBottom: 10 }}>
            Retry loading profile
          </Button>
        ) : null}

        {signedIn ? (
          <>
            <div className="stack-sm">
              <Button block to={paths.player.settings} onClick={profile.close}>
                Profile dashboard
              </Button>
              <Button block variant="secondary" to={paths.player.bookings} onClick={profile.close}>
                My bookings
              </Button>
              <Button block variant="secondary" to={paths.solo.alerts} onClick={profile.close}>
                My LFG alerts
              </Button>
            </div>
            <hr />
            <div className="stack-sm">
              <Button variant="danger" block onClick={signOut}>
                Sign out
              </Button>
              <Button variant="tertiary" block onClick={profile.close}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <div className="stack-sm">
            <Button block to={paths.auth} onClick={profile.close}>
              Sign in
            </Button>
            <Button variant="tertiary" block onClick={profile.close}>
              Close
            </Button>
          </div>
        )}
      </Overlay>

      <ChatWidget />
    </>
  );
}
