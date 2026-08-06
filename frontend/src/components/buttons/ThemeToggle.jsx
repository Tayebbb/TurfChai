<<<<<<< HEAD
import { IconButton } from '@/components/buttons/IconButton';
import { Icon } from '@/components/common/Icon';
import { useTheme } from '@/hooks/useTheme';

/** Light/dark switch wired to <ThemeProvider>. */
export function ThemeToggle({ className }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <IconButton
      className={className}
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </IconButton>
=======
import { useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
  );
}
