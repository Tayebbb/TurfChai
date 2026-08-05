import { useEffect } from 'react';

/** Adds a class to <body> while the component is mounted. */
export function useBodyClass(className, enabled = true) {
  useEffect(() => {
    if (!className || !enabled) return undefined;
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [className, enabled]);
}
