import { useEffect } from 'react';

/** Calls `handler` on pointer-down outside every supplied ref. */
export function useClickOutside(refs, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const list = Array.isArray(refs) ? refs : [refs];

    const onPointerDown = (event) => {
      const inside = list.some((ref) => ref.current?.contains(event.target));
      if (!inside) handler(event);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [refs, handler, enabled]);
}
