import { cn } from '@/utils/cn';

/** Sticky checkout/booking action bar pinned to the viewport bottom. */
export function StickyBar({ className, children }) {
  return (
    <div className={cn('stickybar glass', className)}>
      <div className="stickybar-inner">{children}</div>
    </div>
  );
}
