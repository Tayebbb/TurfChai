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
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSidebar } from '@/hooks/useSidebar';
import { useToast } from '@/hooks/useToast';
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
          label="Notifications"
          onClick={() => showToast('3 new notifications 🔔')}
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
