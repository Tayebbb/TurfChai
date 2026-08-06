<<<<<<< HEAD
import { cn } from '@/utils/cn';

/** Status pill. `tone` maps to the design-system colour classes. */
export function Badge({ tone = 'green', dot = true, className, children, ...rest }) {
  return (
    <span className={cn('badge', tone, !dot && 'nodot', className)} {...rest}>
=======
export function Badge({ children, tone = "default", dot = true, className = "" }) {
  return (
    <span className={`badge ${tone} ${!dot ? "nodot" : ""} ${className}`.trim()}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </span>
  );
}
