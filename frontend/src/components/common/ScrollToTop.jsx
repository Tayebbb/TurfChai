import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Resets scroll on route change unless the browser restores a position. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
