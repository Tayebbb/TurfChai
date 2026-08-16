import { useEffect, useState } from 'react';

/**
 * Delays a fast-changing value (a search box) so callers keyed on it stop
 * firing one request per keystroke.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
