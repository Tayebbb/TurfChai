import { LiquidOrbs } from '@/components/common/LiquidOrbs';
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
      <AppRoutes />
    </>
  );
}
