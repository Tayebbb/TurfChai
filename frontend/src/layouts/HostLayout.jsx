import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
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
        <span className="icon-btn" style={{ ...HOST_ACCENT, fontWeight: 700, border: 'none' }}>
          SL
        </span>
      </Topbar>

      <main id="main">
        <Outlet />
      </main>
    </>
  );
}
