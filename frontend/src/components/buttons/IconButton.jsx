<<<<<<< HEAD
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Square 44px control used across every topbar. */
export function IconButton({ label, notify = false, className, to, href, children, ...rest }) {
  const classes = cn('icon-btn', notify && 'notif-dot', className);
  const a11y = { 'aria-label': label, title: rest.title ?? label };

  if (to) {
    return (
      <Link className={classes} to={to} {...a11y} {...rest}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a className={classes} href={href} {...a11y} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type="button" {...a11y} {...rest}>
=======
export function IconButton({
  children,
  label,
  onClick,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
      {...props}
    >
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </button>
  );
}
