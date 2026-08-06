<<<<<<< HEAD
import { cn } from '@/utils/cn';

/** Blue "✓ Verified" pill. */
export function Verified({ label = 'Verified', className }) {
  return <span className={cn('verified', className)}>✓ {label}</span>;
}

/** Grey skill-level tag (Beginner / Intermediate / Advanced). */
export function Skill({ className, children }) {
  return <span className={cn('skill', className)}>{children}</span>;
}

/** Small grey counter next to section titles. */
export function CountPill({ className, children }) {
  return <span className={cn('countpill', className)}>{children}</span>;
}

/** Red numeric bubble for unread counts. */
export function PillCount({ className, children }) {
  return <span className={cn('pill-count', className)}>{children}</span>;
=======
export function Tag({ children, className = "" }) {
  return (
    <span className={`tag ${className}`.trim()} style={{ padding: "2px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 4, fontSize: "0.75rem" }}>
      {children}
    </span>
  );
}

export function Skill({ level, className = "" }) {
  return (
    <span className={`skill-badge ${className}`.trim()} style={{ padding: "2px 8px", background: "var(--brand-soft)", color: "var(--brand-500)", borderRadius: 12, fontSize: "0.75rem", fontWeight: 600 }}>
      {level}
    </span>
  );
}

export function Verified({ className = "" }) {
  return (
    <span className={`verified-badge ${className}`.trim()} style={{ color: "var(--brand-500)", fontWeight: 700 }} title="Verified Venue">
      ✓ Verified
    </span>
  );
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
}
