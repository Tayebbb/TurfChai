import { cn } from '@/utils/cn';
import { useCountdown } from '@/hooks/useCountdown';

/** Amber slot-lock timer. Counts down from `seconds`. */
export function LockTimer({ seconds, prefix = 'Slot held', onExpire, className }) {
  const { label } = useCountdown(seconds, { onExpire });

  return (
    <span className={cn('lock-timer', className)}>
      <span aria-hidden="true">⏳</span>
      {prefix} <b>{label}</b>
    </span>
  );
}
