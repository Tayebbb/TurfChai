import { Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
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
import { PLAYER_BOTTOM_NAV, PLAYER_NAV_LINKS } from '@/constants/navigation';
import { playerNotifications } from '@/data/notifications';
import { getMyProfile } from '@/api/players';
import { clearSession } from '@/api/client';
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

  const me = useApi(() => getMyProfile(), []);
  const player = me.data;
  const initials =
    player?.avatarInitials ||
    (player?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ||
    '\u00b7';

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
          label={`Notifications, ${playerNotifications.length} unread`}
          notify
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
              👤
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
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {playerNotifications.map((item) => (
            <Panel key={item.id}>
              <b>{item.title}</b>
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {item.body}
              </p>
              <span className="tiny subtle">{item.when}</span>
            </Panel>
          ))}
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
    </>
  );
}
