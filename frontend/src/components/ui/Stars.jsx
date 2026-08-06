<<<<<<< HEAD
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
=======
export function Stars({ rating = 5, count, className = "" }) {
  const fullStars = Math.floor(rating);
  return (
    <div className={`stars-display ${className}`.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--amber-500)" }}>
      {"★".repeat(fullStars)}
      {"☆".repeat(5 - fullStars)}
      {count !== undefined && <span className="small muted" style={{ color: "var(--text-muted)", marginLeft: 4 }}>({count})</span>}
    </div>
  );
}

export function Rating({ score, count, className = "" }) {
  return (
    <div className={`rating-tag ${className}`.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85rem", fontWeight: 600 }}>
      <span style={{ color: "var(--amber-500)" }}>★</span> {score} {count !== undefined && <span className="subtle">({count})</span>}
    </div>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
  );
}
