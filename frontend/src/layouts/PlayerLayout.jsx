import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { PLAYER_BOTTOM_NAV, PLAYER_NAV_LINKS } from '@/constants/navigation';
import { getMyProfile } from '@/api/players';
import { getNotifications, getUnreadCount, markAllRead } from '@/api/notifications';
import { clearSession, getUser } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useBodyClass } from '@/hooks/useBodyClass';
import { useDisclosure } from '@/hooks/useDisclosure';
import { paths } from '@/routes/paths';

/**
 * Shell for every player, solo and host-tool screen: glass topbar,
 * mobile bottom nav, shared notification drawer and profile sheet.
 */
export function PlayerLayout({ withFooter = false }) {
  const notifications = useDisclosure(false);
  const profile = useDisclosure(false);
  const navigate = useNavigate();
  useBodyClass('has-bottomnav');

  const { data: notifData, reload: reloadNotifs } = useApi(getNotifications, []);
  const { data: unreadData, reload: reloadUnread } = useApi(getUnreadCount, []);
  
  const notificationsList = notifData || [];
  const unreadCount = unreadData?.count || 0;

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      reloadNotifs();
      reloadUnread();
    } catch (e) {
      console.error(e);
    }
  };

  const me = useApi(() => getMyProfile(), []);
  const localUser = getUser();

  useEffect(() => {
    const handleSession = () => me.reload();
    window.addEventListener('turfchai:session-change', handleSession);
    return () => window.removeEventListener('turfchai:session-change', handleSession);
  }, [me]);

  const fullName = localUser?.fullName || me.data?.fullName || 'Player';
  const player = me.data ? { ...me.data, fullName } : localUser;
  const initials =
    (fullName ?? '').split(/\s+/).filter(Boolean).length === 1
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
      <Topbar brand={<Brand to={paths.player.home} />} links={PLAYER_NAV_LINKS}>
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
      </Topbar>

      <RouteErrorBoundary>
        <Outlet />
      </RouteErrorBoundary>

      {withFooter ? <SiteFooter /> : null}

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
              <Panel key={item.id} style={{ opacity: item.isRead ? 0.6 : 1 }}>
                <b>{item.title}</b>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {item.body}
                </p>
                <span className="tiny subtle">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </span>
              </Panel>
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
          <Avatar name={player?.fullName ?? 'Player'} initials={initials} size="lg" />
          <div style={{ minWidth: 0 }}>
            <b>{player?.fullName ?? (me.loading ? 'Loading…' : 'Your profile')}</b>
            <div className="subtle">
              {[player?.phone, player?.area].filter(Boolean).join(' · ') ||
                (me.error ? 'Profile unavailable — check your connection' : '\u00a0')}
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

        {me.error ? (
          <Button block variant="secondary" onClick={me.reload} style={{ marginBottom: 10 }}>
            Retry loading profile
          </Button>
        ) : null}

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
      </Overlay>

      <ChatWidget />
    </>
  );
}
