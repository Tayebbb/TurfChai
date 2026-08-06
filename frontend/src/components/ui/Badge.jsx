import { cn } from '@/utils/cn';

/** Status pill. `tone` maps to the design-system colour classes. */
export function Badge({ tone = 'green', dot = true, className, children, ...rest }) {
  return (
    <span className={cn('badge', tone, !dot && 'nodot', className)} {...rest}>
      {children}
    </span>
  );
}
