import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { ThemeToggle } from '@/components/buttons/ThemeToggle';
import { Topbar } from '@/components/navigation/Topbar';

/** Distraction-free shell for auth and onboarding flows. */
export function AuthLayout() {
  return (
    <>
      <Topbar brand={<Brand />}>
        <ThemeToggle />
      </Topbar>
      <main id="main" tabIndex={-1}>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </>
  );
}
