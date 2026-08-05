import { useCallback, useMemo, useState } from 'react';

/**
 * Multi-select filter chips (Explore, Open games, Reports…).
 * Returns the active set plus a toggle and reset.
 */
export function useFilterChips(initial = []) {
  const [active, setActive] = useState(() => new Set(initial));

  const toggle = useCallback((id) => {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setActive(new Set()), []);
  const isActive = useCallback((id) => active.has(id), [active]);

  return useMemo(
    () => ({ active, isActive, toggle, clear, count: active.size }),
    [active, isActive, toggle, clear],
  );
}
