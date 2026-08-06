import { cn } from '@/utils/cn';

/** Muted inset block used for list rows and secondary info. */
export function Panel({ className, children, ...rest }) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  );
}
