import { LiquidOrbs } from '@/components/common/LiquidOrbs';
import { RouteAnnouncer } from '@/components/common/RouteAnnouncer';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { AppRoutes } from '@/routes/AppRoutes';

export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <LiquidOrbs />
      <ScrollToTop />
      <RouteAnnouncer />
      <AppRoutes />
    </>
  );
}
