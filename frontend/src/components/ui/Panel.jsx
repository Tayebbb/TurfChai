<<<<<<< HEAD
import { cn } from '@/utils/cn';

/** Muted inset block used for list rows and secondary info. */
export function Panel({ className, children, ...rest }) {
  return (
    <div className={cn('panel', className)} {...rest}>
=======
export function Panel({ children, className = "", ...props }) {
  return (
    <div className={`panel ${className}`.trim()} {...props}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}
