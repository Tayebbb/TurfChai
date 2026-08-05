import { cn } from '@/utils/cn';

/** Five-star display. `value` is 0–5 and rounds to the nearest star. */
export function Stars({ value = 0, className }) {
  const filled = Math.round(Math.min(5, Math.max(0, value)));
  return (
    <span className={cn('stars', className)} aria-label={`${value} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(filled)}</span>
      <span className="off" aria-hidden="true">
        {'★'.repeat(5 - filled)}
      </span>
    </span>
  );
}

/** Compact numeric rating used on venue cards. */
export function Rating({ value, count, className }) {
  return (
    <span className={cn('rating', className)}>
      {value}
      {count != null ? <span className="subtle"> ({count})</span> : null}
    </span>
  );
}
