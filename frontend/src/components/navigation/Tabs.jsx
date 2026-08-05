import { cn } from '@/utils/cn';

/** Underlined tab bar driven by controlled state. */
export function Tabs({ items, value, onChange, label = 'Sections', className }) {
  return (
    <div className={cn('tabs', className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          className={cn('tab', value === item.id && 'on')}
          type="button"
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={value === item.id}
          aria-controls={`panel-${item.id}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Panel body for a `Tabs` entry — renders only when selected. */
export function TabPanel({ id, value, className, children }) {
  if (value !== id) return null;
  return (
    <div
      className={cn('tabpanel on', className)}
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
    >
      {children}
    </div>
  );
}

/** Pill segmented control. `glass` and `size` mirror the CSS modifiers. */
export function Segmented({
  items,
  value,
  onChange,
  glass = false,
  size = 'md',
  label = 'View',
  className,
  ...rest
}) {
  return (
    <div
      className={cn('seg', glass && 'glass', size === 'lg' && 'lg', className)}
      role="tablist"
      aria-label={label}
      {...rest}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className={cn(value === item.id && 'on')}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
