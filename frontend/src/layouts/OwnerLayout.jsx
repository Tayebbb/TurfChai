import { useEffect, useReducer } from 'react';
import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Badge } from '@/components/ui/Badge';
import { OWNER_NAV_LINKS } from '@/constants/navigation';
import { clearSession, getUser } from '@/api/client';
import { getNotifications, getUnreadCount, markAllRead as markAllNotificationsRead, markRead as markNotificationRead } from '@/api/notifications';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { paths } from '@/routes/paths';
import { toUserMessage } from '@/utils/errorMessage';

const fallbackInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Owner console shell: full-bleed glass topbar + alerts drawer + account sheet. */
export function OwnerLayout() {
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const { showToast } = useToast();
  const account = useDisclosure(false);
  const alerts = useDisclosure(false);

  useEffect(() => {
    const handler = () => forceRender();
    window.addEventListener('turfchai:session-change', handler);
    return () => window.removeEventListener('turfchai:session-change', handler);
  }, []);

  const session = getUser();
  const owner = {
    initials: session?.avatarInitials || fallbackInitials(session?.fullName),
    name: session?.fullName || 'Turf Owner',
    area: session?.area || '—',
    email: session?.email || '—',
  };

  const notificationsApi = useApi(getNotifications, []);
  const unreadApi = useApi(getUnreadCount, []);
  const ownerAlerts = Array.isArray(notificationsApi.data) ? notificationsApi.data : [];
  const unreadCount = unreadApi.data?.count ?? 0;
  const allRead = ownerAlerts.length === 0 || ownerAlerts.every((alert) => alert.isRead);

  const refreshAlerts = () => {
    notificationsApi.reload();
    unreadApi.reload();
  };

  const markRead = (id) => {
    markNotificationRead(id)
      .then(refreshAlerts)
      .catch((e) => showToast(toUserMessage(e, 'Could not mark that alert as read.')));
  };

  const markAllRead = () => {
    markAllNotificationsRead()
      .then(refreshAlerts)
      .catch((e) => showToast(toUserMessage(e, 'Could not mark alerts as read.')));
  };

  return (
    <>
      <Topbar
        className="admin-topbar owner-topbar"
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
        links={OWNER_NAV_LINKS}
      >
        <div className="admin-actions owner-actions">
          <IconButton className="admin-ico" label="View alerts" onClick={alerts.open}>
            <Icon name="bell" />
            {unreadCount > 0 && <span className="admin-badge owner-badge">{unreadCount}</span>}
          </IconButton>
          <ThemeToggle className="admin-ico" />
          <IconButton
            className="admin-avatar owner-avatar"
            label="Owner Account & Settings"
            onClick={account.open}
          >
            {owner.initials}
            <span className="admin-online owner-online" aria-hidden="true" />
          </IconButton>
          <IconButton
            className="admin-ico admin-logout"
            label="Sign Out"
            to={paths.auth}
            onClick={() => clearSession()}
          >
            <Icon name="logout" />
          </IconButton>
        </div>
      </Topbar>

      <main className="admin-page-wrap owner-page-wrap" id="main" tabIndex={-1}>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>

      {/* Notifications / Alerts Drawer */}
      <Overlay isOpen={alerts.isOpen} onClose={alerts.close} mode="drawer" hideHeader className="admin-alerts-modal owner-alerts-modal">
        <div className="admin-alerts owner-alerts">
          <div className="admin-alerts-head">
            <div className="admin-alerts-title">
              <span className="admin-alerts-bell">
                <Icon name="bell" size={15} />
              </span>
              <h3>Venue alerts</h3>
              {unreadCount > 0 && <span className="admin-alerts-count">{unreadCount} new</span>}
            </div>
            <div className="row" style={{ gap: 6 }}>
              {unreadCount > 0 && (
                <button className="admin-alerts-mark" type="button" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
              <IconButton label="Close alerts" onClick={alerts.close}>
                <Icon name="close" />
              </IconButton>
            </div>
          </div>

          {allRead ? (
            <div className="admin-alerts-empty owner-alerts-empty">
              <div className="admin-alerts-empty-icon owner-alerts-empty-icon">
                <Icon name="check" size={26} />
              </div>
              <b>You&rsquo;re all caught up</b>
              <span>No pending notifications or alerts for your turf right now.</span>
            </div>
          ) : (
            <div className="admin-alerts-list owner-alerts-list">
              {ownerAlerts.map((alert, index) => (
                <button
                  key={alert.id}
                  type="button"
                  className={cn('alert-item', 'tone-blue', alert.isRead && 'read')}
                  style={{ animationDelay: `${index * 55}ms` }}
                  onClick={() => markRead(alert.id)}
                >
                  <span className="alert-item-icon">
                    <Icon name="alert" />
                  </span>
                  <span className="alert-item-body">
                    <span className="alert-item-title">
                      <b>{alert.title}</b>
                    </span>
                    <span className="alert-item-text">{alert.body}</span>
                    <span className="alert-item-meta">
                      {!alert.isRead && <span className="alert-item-dot" aria-hidden="true" />}
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Overlay>

      {/* Owner Profile & Workspace Action Sheet */}
      <Overlay isOpen={account.isOpen} onClose={account.close} title="Owner Account" mode="sheet" showGrabber hideHeader>
        <div className="row" style={{ marginBottom: 16, alignItems: 'center', gap: 12 }}>
          <span className="avatar lg b" style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)', color: '#fff', fontSize: 18, fontWeight: 800 }}>
            {owner.initials}
          </span>
          <div>
            <b style={{ fontSize: 16, display: 'block' }}>{owner.name}</b>
            <div className="subtle small">
              {owner.area !== '—' ? `${owner.area} · ` : ''}{owner.email}
            </div>
          </div>
        </div>
        <div className="stack-sm">
          <Button variant="secondary" block to={paths.owner.venueSetup} onClick={account.close}>
            🏟️ Pitch & Venue Settings
          </Button>
          <Button variant="secondary" block to={paths.owner.payments} onClick={account.close}>
            📈 Payouts & Financial Reports
          </Button>
          <Button variant="tertiary" block to={paths.player.home} onClick={account.close}>
            ⚽ Switch to Player Workspace
          </Button>
          <Button
            variant="danger"
            block
            to={paths.auth}
            onClick={() => {
              account.close();
              clearSession();
            }}
            style={{ marginTop: 8 }}
          >
            🚪 Sign Out
          </Button>
        </div>
        <Button variant="tertiary" block onClick={account.close} style={{ marginTop: 10 }}>
          Close
        </Button>
      </Overlay>
    </>
  );
}
