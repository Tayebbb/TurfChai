<<<<<<< HEAD
import { cn } from '@/utils/cn';

/** Horizontal progress bar. `value` is 0–100. */
export function Progress({ value = 0, tone, label, className }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('progress', tone, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <i style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Circular progress ring with a centred value. */
export function Ring({ value = 0, caption, size = 96, children }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle className="track" cx="48" cy="48" r={radius} />
        <circle
          className="bar"
          cx="48"
          cy="48"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <div className="mid">
        {children ?? `${Math.round(clamped)}%`}
        {caption ? <span>{caption}</span> : null}
      </div>
=======
export function Progress({ value = 0, max = 100, className = "" }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`progress-bar ${className}`.trim()} style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${percentage}%`, height: "100%", background: "var(--brand-500)", borderRadius: 99 }} />
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    </div>
  );
}
