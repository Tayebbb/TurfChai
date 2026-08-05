import { useCountUp } from '@/hooks/useCountUp';

/**
 * Animated metric value that counts up from 0 on mount,
 * formatted with thousands separators.
 */
export function CountUp({ to, duration, delay, className, style }) {
  const value = useCountUp(to, { duration, delay });
  return (
    <span className={className} style={style}>
      {value.toLocaleString('en-US')}
    </span>
  );
}
