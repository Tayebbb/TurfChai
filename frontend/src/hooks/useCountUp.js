import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates a number from 0 to `target` on mount.
 * Returns the current eased value (rounded to whole numbers).
 */
export function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    let timer;
    timer = setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(target * eased);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return Math.round(value);
}
