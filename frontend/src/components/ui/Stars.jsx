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
  const hasRating = value != null && Number(value) > 0;
  const hasCount = count != null && Number(count) > 0;

  if (!hasRating && !hasCount) {
    return (
      <span className={cn('rating', className)} style={{ background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: '0.85em', fontWeight: 600 }}>
        New
      </span>
    );
  }

  return (
    <span className={cn('rating', className)}>
      {hasRating ? (Number(value) % 1 === 0 ? Number(value).toFixed(1) : value) : 'New'}
      {hasCount ? <span className="subtle"> ({count})</span> : null}
    </span>
  );
}
