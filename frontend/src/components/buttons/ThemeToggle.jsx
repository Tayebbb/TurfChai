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
  );
}
