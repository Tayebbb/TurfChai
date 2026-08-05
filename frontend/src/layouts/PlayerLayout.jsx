import { Link, Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
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
import { currentPlayer } from '@/data/users';
import { playerNotifications } from '@/data/notifications';
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
  useBodyClass('has-bottomnav');

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
          {currentPlayer.initials}
        </IconButton>
      </Topbar>

      <Outlet />

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
        <div className="row" style={{ marginBottom: 14 }}>
          <Avatar name={currentPlayer.name} initials={currentPlayer.initials} size="lg" />
          <div>
            <b>{currentPlayer.name}</b>
            <div className="subtle">
              {currentPlayer.phone} · {currentPlayer.area}
            </div>
            <div className="row-wrap" style={{ marginTop: 4 }}>
              <Badge tone="green">{currentPlayer.tier}</Badge>
              <Badge tone="blue" dot={false}>
                {currentPlayer.reliability}% reliability
              </Badge>
            </div>
          </div>
        </div>
        <div className="stack-sm">
          <Button block to={paths.player.bookings} onClick={profile.close}>
            My bookings
          </Button>
          <Button block to={paths.solo.alerts} onClick={profile.close}>
            My LFG alerts
          </Button>
          <Button block to={paths.player.onboarding} onClick={profile.close}>
            Edit preferences
          </Button>
        </div>
        <hr />
        <p className="tiny subtle" style={{ marginBottom: 8 }}>
          SWITCH WORKSPACE
        </p>
        <div className="stack-sm">
          <Button block to={paths.owner.dashboard} onClick={profile.close}>
            🏟️ Owner workspace — Kick Off Arena
          </Button>
          <Link className="btn btn-secondary btn-block" to={paths.host.hub} onClick={profile.close}>
            🏆 Tournament host
          </Link>
        </div>
        <Button variant="tertiary" block onClick={profile.close} style={{ marginTop: 10 }}>
          Close
        </Button>
      </Overlay>
    </>
  );
}
