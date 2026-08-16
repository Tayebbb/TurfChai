import { cn } from '@/utils/cn';

/**
 * Horizontally scrollable table container.
 *
 * A plain `<div class="table-wrap">` scrolls with a mouse but not with a
 * keyboard, which axe reports as `scrollable-region-focusable`. Making the
 * region focusable and naming it gives keyboard and screen-reader users the
 * same access to the columns that overflow.
 */
export function TableScroll({ label, className, style, children }) {
  return (
    <div
      className={cn('table-wrap', className)}
      style={style}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}
