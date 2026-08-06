<<<<<<< HEAD
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
=======
export function Chip({ children, active, onClick, className = "" }) {
  return (
    <button
      type="button"
      className={`chip ${active ? "active" : ""} ${className}`.trim()}
      onClick={onClick}
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    >
      {children}
    </button>
  );
}

<<<<<<< HEAD
export function ChipRow({ className, children, ...rest }) {
  return (
    <div className={cn('chiprow', className)} {...rest}>
=======
export function ChipRow({ children, className = "" }) {
  return (
    <div className={`chip-row ${className}`.trim()} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}
