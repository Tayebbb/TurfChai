import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Icon } from '@/components/common/Icon';
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

/** Super-admin console shell: full-bleed glass topbar + alert drawer. */
export function AdminLayout() {
  const alerts = useDisclosure(false);

  return (
    <>
      <Topbar
        innerStyle={{ maxWidth: '100%', padding: '0 28px' }}
        brand={
          <Brand
            to={paths.admin.dashboard}
            badge={
              <Badge tone="red" dot={false}>
                {currentAdmin.role}
              </Badge>
            }
          />
        }
      >
        <IconButton label="View alerts" notify onClick={alerts.open}>
          <Icon name="bell" />
        </IconButton>
        <ThemeToggle />
        <IconButton
          label="My profile"
          to={paths.admin.profile}
          style={{
            background: 'var(--brand-soft)',
            color: 'var(--brand-600)',
            fontWeight: 700,
            border: '1px solid var(--brand)',
            textDecoration: 'none',
          }}
        >
          {currentAdmin.initials}
        </IconButton>
      </Topbar>

      <main className="admin-page-wrap" id="main">
        <Outlet />
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
