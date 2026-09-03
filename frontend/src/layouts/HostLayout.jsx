import { Link, Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';
import { paths } from '@/routes/paths';

const HOST_ACCENT = { background: '#EDE4FF', color: '#6D3FC4' };

/** Tournament-host shell: purple-accented topbar over a plain content column. */
export function HostLayout() {
  return (
    <>
      <Topbar
        brand={
          <Brand
            to={paths.host.hub}
            badge={
              <span className="badge nodot" style={HOST_ACCENT}>
                Host
              </span>
            }
          />
        }
      >
        <ThemeToggle />
        {/* ponytail: the old "SL" span mimicked the .icon-btn class without
           being interactive or meaningful. Ceiling: real avatar + account menu
           when host sessions get a profile endpoint. */}
        <Link
          to={paths.player.home}
          className="btn btn-sm btn-secondary"
          style={{ ...HOST_ACCENT, background: HOST_ACCENT.background, fontWeight: 700 }}
        >
          Exit host view
        </Link>
      </Topbar>

      <main id="main" tabIndex={-1}>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </>
  );
}
