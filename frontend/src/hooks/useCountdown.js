import { useEffect, useRef, useState } from 'react';
import { formatClock } from '@/utils/format';

/**
 * Ticking countdown used by slot locks and payment holds.
 * Returns the remaining seconds plus a pre-formatted `m:ss` label.
 */
export function useCountdown(seconds, { onExpire } = {}) {
  const [remaining, setRemaining] = useState(seconds);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        expireRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return { remaining, label: formatClock(remaining), isExpired: remaining <= 0 };
}
