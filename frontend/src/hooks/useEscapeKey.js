import { useEffect } from 'react';

/** Runs `handler` when Escape is pressed, while `enabled`. */
export function useEscapeKey(handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, enabled]);
}
