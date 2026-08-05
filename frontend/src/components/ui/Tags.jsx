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
}
