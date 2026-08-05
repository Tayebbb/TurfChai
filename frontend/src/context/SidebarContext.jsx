import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BREAKPOINTS } from '@/constants/app';

export const SidebarContext = createContext(null);

/**
 * Owner console sidebar: a slide-in drawer under 900px and a
 * collapsible column above it — matching the original body classes.
 */
export function SidebarProvider({ children }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);

  // Navigating away always dismisses the mobile drawer.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', isDrawerOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [isDrawerOpen]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-closed', isCollapsed);
    return () => document.body.classList.remove('sidebar-closed');
  }, [isCollapsed]);

  const toggle = useCallback(() => {
    if (window.innerWidth <= BREAKPOINTS.sidebar) {
      setDrawerOpen((open) => !open);
    } else {
      setCollapsed((collapsed) => !collapsed);
    }
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo(
    () => ({ isDrawerOpen, isCollapsed, toggle, closeDrawer }),
    [isDrawerOpen, isCollapsed, toggle, closeDrawer],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
