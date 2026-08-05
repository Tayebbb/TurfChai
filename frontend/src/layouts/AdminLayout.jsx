import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Badge } from '@/components/ui/Badge';
import { adminAlerts } from '@/data/admin';
import { currentAdmin } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/utils/cn';
import { paths } from '@/routes/paths';
import { ADMIN_NAV_LINKS } from '@/constants/navigation';

const ALERT_ICONS = { amber: 'file', blue: 'money', red: 'alert', gray: 'activity' };

/** Super-admin console shell: full-bleed glass topbar + alert drawer. */
export function AdminLayout() {
  const alerts = useDisclosure(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const unreadCount = adminAlerts.filter((alert) => !readIds.has(alert.id)).length;
  const allRead = readIds.size >= adminAlerts.length;

  const markRead = (id) => setReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => setReadIds(new Set(adminAlerts.map((alert) => alert.id)));

  return (
    <>
      <Topbar className="admin-topbar" brand={<Brand to={paths.admin.dashboard} />} links={ADMIN_NAV_LINKS}>
        <div className="admin-actions">
          <IconButton className="admin-ico" label="View alerts" onClick={alerts.open}>
            <Icon name="bell" />
            {unreadCount > 0 && <span className="admin-badge">{unreadCount}</span>}
          </IconButton>
          <ThemeToggle className="admin-ico" />
          <IconButton className="admin-avatar" label="My profile" to={paths.admin.profile}>
            {currentAdmin.initials}
            <span className="admin-online" aria-hidden="true" />
          </IconButton>
          <IconButton className="admin-ico admin-logout" label="Sign Out" to={paths.auth}>
            <Icon name="logout" />
          </IconButton>
        </div>
      </Topbar>

      <main className="admin-page-wrap" id="main" tabIndex={-1}>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>

      <Overlay isOpen={alerts.isOpen} onClose={alerts.close} mode="drawer" hideHeader className="admin-alerts-modal">
        <div className="admin-alerts">
          <div className="admin-alerts-head">
            <div className="admin-alerts-title">
              <span className="admin-alerts-bell">
                <Icon name="bell" size={15} />
              </span>
              <h3>Platform alerts</h3>
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
            <div className="admin-alerts-empty">
              <div className="admin-alerts-empty-icon">
                <Icon name="check" size={26} />
              </div>
              <b>You&rsquo;re all caught up</b>
              <span>No pending platform alerts right now.</span>
            </div>
          ) : (
            <div className="admin-alerts-list">
              {adminAlerts.map((alert, index) => (
                <button
                  key={alert.id}
                  type="button"
                  className={cn('alert-item', `tone-${alert.tone}`, readIds.has(alert.id) && 'read')}
                  style={{ animationDelay: `${index * 55}ms` }}
                  onClick={() => markRead(alert.id)}
                >
                  <span className="alert-item-icon">
                    <Icon name={ALERT_ICONS[alert.tone] ?? 'alert'} />
                  </span>
                  <span className="alert-item-body">
                    <span className="alert-item-title">
                      <b>{alert.title}</b>
                      <Badge tone={alert.tone}>{alert.label}</Badge>
                    </span>
                    <span className="alert-item-text">{alert.body}</span>
                    <span className="alert-item-meta">
                      {!readIds.has(alert.id) && <span className="alert-item-dot" aria-hidden="true" />}
                      {alert.when}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="admin-alerts-foot">
            <Link to={paths.admin.activity} onClick={alerts.close}>
              View full activity log →
            </Link>
          </div>
        </div>
      </Overlay>
    </>
  );
}
