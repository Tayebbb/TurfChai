import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Topbar } from '@/components/navigation/Topbar';
import { Overlay } from '@/components/modals/Overlay';
import { Badge } from '@/components/ui/Badge';
import { SidebarProvider } from '@/context/SidebarContext';
import { OWNER_NAV_LINKS } from '@/constants/navigation';
import { currentOwner } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSidebar } from '@/hooks/useSidebar';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

function OwnerChrome() {
  const { toggle } = useSidebar();
  const account = useDisclosure(false);
  const { showToast } = useToast();

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
          {currentOwner.initials}
        </IconButton>
      </Topbar>

      <div className="shell wrap" style={{ maxWidth: 1280 }}>
        <Sidebar links={OWNER_NAV_LINKS} label="Owner workspace" />
        <main className="main" id="main">
          <Outlet />
        </main>
      </div>

      <Overlay isOpen={account.isOpen} onClose={account.close} title="Account" mode="sheet" showGrabber hideHeader>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="avatar lg b">{currentOwner.initials}</span>
          <div>
            <b>{currentOwner.name}</b>
            <div className="subtle">
              {currentOwner.venue} · {currentOwner.area}
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
