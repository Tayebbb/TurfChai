import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Badge } from '@/components/ui/Badge';
import { SidebarProvider } from '@/context/SidebarContext';
import { OWNER_NAV_LINKS } from '@/constants/navigation';
import { getUser } from '@/api/client';
import { getNotifications, getUnreadCount, markAllRead } from '@/api/notifications';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSidebar } from '@/hooks/useSidebar';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';

const fallbackInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function OwnerChrome() {
  const { toggle } = useSidebar();
  const account = useDisclosure(false);
  const notifications = useDisclosure(false);
  const { showToast } = useToast();
  const [, forceRender] = useState(0);
  useEffect(() => {
    const handler = () => forceRender((x) => x + 1);
    window.addEventListener('turfchai:session-change', handler);
    return () => window.removeEventListener('turfchai:session-change', handler);
  }, []);
  const session = getUser();
  const owner = {
    initials: session?.avatarInitials || fallbackInitials(session?.fullName),
    name: session?.fullName || 'Owner',
    area: session?.area || '—',
    email: session?.email || '—',
  };

  const { data: notifData, reload: reloadNotifs } = useApi(getNotifications, []);
  const { data: unreadData, reload: reloadUnread } = useApi(getUnreadCount, []);
  const notificationsList = Array.isArray(notifData) ? notifData : [];
  const unreadCount = unreadData?.count ?? 0;

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (e) {
      showToast(toUserMessage(e, 'Could not mark your notifications as read.'));
      return;
    }
    reloadNotifs();
    reloadUnread();
  };

  return (
    <>
      <Topbar
        leading={
          <IconButton className="mobile-menu-btn" label="Toggle menu" onClick={toggle}>
            ☰
          </IconButton>
        }
        brand={
          <Brand
            to={paths.owner.dashboard}
            badge={
              <Badge tone="blue" dot={false}>
                Owner
              </Badge>
            }
          />
        }
      >
        <IconButton
          label={`Notifications, ${unreadCount} unread`}
          notify={unreadCount > 0}
          onClick={notifications.open}
        >
          <span aria-hidden="true">🔔</span>
        </IconButton>
        <ThemeToggle />
        <IconButton
          label="Account"
          onClick={account.open}
          style={{
            background: 'var(--info-soft)',
            color: 'var(--info)',
            fontWeight: 700,
            border: 'none',
          }}
        >
          {owner.initials}
        </IconButton>
      </Topbar>

      <div className="shell wrap" style={{ maxWidth: 1280 }}>
        <Sidebar links={OWNER_NAV_LINKS} label="Owner workspace" />
        <main className="main" id="main" tabIndex={-1}>
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>

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
            <div className="subtle center" style={{ padding: '40px 0' }}>
              No notifications yet.
            </div>
          ) : (
            notificationsList.map((item) => (
              <div className="panel" key={item.id} style={{ opacity: item.isRead ? 0.6 : 1 }}>
                <b>{item.title}</b>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {item.body}
                </p>
                <span className="tiny subtle">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </Overlay>

      <Overlay isOpen={account.isOpen} onClose={account.close} title="Account" mode="sheet" showGrabber hideHeader>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="avatar lg b">{owner.initials}</span>
          <div>
            <b>{owner.name}</b>
            <div className="subtle">
              {owner.area} · {owner.email}
            </div>
          </div>
        </div>
        <div className="stack-sm">
          <Button block to={paths.owner.venueSetup} onClick={account.close}>
            Venue settings
          </Button>
          <Button block to={paths.owner.staff} onClick={account.close}>
            Staff &amp; shifts
          </Button>
          <Button block to={paths.player.home} onClick={account.close}>
            ⚽ Switch to player workspace
          </Button>
          <Button variant="danger" block to={paths.auth} onClick={account.close} style={{ marginTop: 8 }}>
            🚪 Sign Out / Change Role
          </Button>
        </div>
        <Button variant="tertiary" block onClick={account.close} style={{ marginTop: 10 }}>
          Close
        </Button>
      </Overlay>
    </>
  );
}

/** Owner console shell: topbar + collapsible sidebar + main column. */
export function OwnerLayout() {
  return (
    <SidebarProvider>
      <OwnerChrome />
    </SidebarProvider>
  );
}
