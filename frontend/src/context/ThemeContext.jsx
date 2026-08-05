import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/constants/app';

export const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);
  const fadeTimer = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage blocked — the in-memory theme still applies */
    }
  }, [theme]);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const toggleTheme = useCallback(() => {
    // Brief class that crossfades every colour token while the palette swaps.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => root.classList.remove('theme-switching'), 380);
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
