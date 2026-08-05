import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { adminAlerts } from '@/data/admin';
import { currentAdmin } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { paths } from '@/routes/paths';
import { ADMIN_NAV_LINKS } from '@/constants/navigation';

/** Super-admin console shell: full-bleed glass topbar + alert drawer. */
export function AdminLayout() {
  const alerts = useDisclosure(false);

  return (
    <>
      <Topbar className="admin-topbar" brand={<Brand to={paths.admin.dashboard} />} links={ADMIN_NAV_LINKS}>
        <div className="admin-actions">
          <IconButton className="admin-ico" label="View alerts" onClick={alerts.open}>
            <Icon name="bell" />
            <span className="admin-badge">{adminAlerts.length}</span>
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

      <Overlay isOpen={alerts.isOpen} onClose={alerts.close} title="Platform alerts" mode="drawer">
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {adminAlerts.map((alert) => (
            <Panel key={alert.id}>
              <div className="between">
                <b>{alert.title}</b>
                <Badge tone={alert.tone}>{alert.label}</Badge>
              </div>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                {alert.body}
              </p>
              <span className="tiny subtle">{alert.when}</span>
            </Panel>
          ))}
        </div>
      </Overlay>
    </>
  );
}
