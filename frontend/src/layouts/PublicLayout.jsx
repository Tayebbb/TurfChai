import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/buttons/Button';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PUBLIC_NAV_LINKS } from '@/constants/navigation';
import { paths } from '@/routes/paths';

/** Marketing shell for the landing page and other signed-out screens. */
export function PublicLayout() {
  return (
    <>
      <Topbar brand={<Brand />} links={PUBLIC_NAV_LINKS}>
        <ThemeToggle />
        <Button variant="tertiary" to={paths.auth}>
          Sign in
        </Button>
        <Button variant="primary" to={paths.auth}>
          Get started
        </Button>
      </Topbar>

      <main id="main">
        <Outlet />
      </main>

      <SiteFooter />
    </>
  );
}
