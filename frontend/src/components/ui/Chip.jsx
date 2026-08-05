import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Filter/quick-link pill. Toggles when `onToggle` is supplied. */
export function Chip({ active = false, to, onToggle, className, children, ...rest }) {
  const classes = cn('chip', active && 'on', className);

  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      type="button"
      aria-pressed={onToggle ? active : undefined}
      onClick={onToggle}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ChipRow({ className, children, ...rest }) {
  return (
    <div className={cn('chiprow', className)} {...rest}>
      {children}
    </div>
  );
}
