import { useEffect, useReducer, useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
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

/** Owner console shell: full-bleed glass topbar + alerts drawer + rollout sign out. */
export function OwnerLayout() {
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const { showToast } = useToast();
  const alerts = useDisclosure(false);
  const [showLogout, setShowLogout] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = () => forceRender();
    window.addEventListener('turfchai:session-change', handler);
    return () => window.removeEventListener('turfchai:session-change', handler);
  }, []);

  useEffect(() => {
    if (!showLogout) return;
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowLogout(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowLogout(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLogout]);

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
        <div className="admin-actions owner-actions" ref={profileRef}>
          <IconButton className="admin-ico" label="View alerts" onClick={alerts.open}>
            <Icon name="bell" />
            {unreadCount > 0 && <span className="admin-badge owner-badge">{unreadCount}</span>}
          </IconButton>
          <ThemeToggle className="admin-ico" />
          
          <div className={cn('owner-profile-cluster', showLogout && 'open')}>
            <IconButton
              className={cn('admin-ico admin-logout owner-rollout-logout', showLogout && 'visible')}
              label="Sign Out"
              to={paths.auth}
              onClick={() => clearSession()}
              tabIndex={showLogout ? 0 : -1}
              aria-hidden={!showLogout}
            >
              <Icon name="logout" />
            </IconButton>

            <IconButton
              className={cn('admin-avatar owner-avatar', showLogout && 'active')}
              label={showLogout ? 'Hide sign out button' : `Owner account (${owner.name}) — Click to sign out`}
              onClick={() => setShowLogout((prev) => !prev)}
              aria-expanded={showLogout}
            >
              {owner.initials}
              <span className="admin-online owner-online" aria-hidden="true" />
            </IconButton>
          </div>
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
    </>
  );
}
