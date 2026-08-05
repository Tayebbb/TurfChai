import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';

/** Distraction-free shell for auth and onboarding flows. */
export function AuthLayout() {
  return (
    <>
      <Topbar brand={<Brand />}>
        <ThemeToggle />
      </Topbar>
      <main id="main">
        <Outlet />
      </main>
    </>
  );
}
