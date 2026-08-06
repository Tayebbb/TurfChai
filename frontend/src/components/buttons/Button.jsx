import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  danger: 'btn-danger',
  ghostDanger: 'btn-ghost-danger',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * Renders an `<a>` (external), a router `<Link>` (`to`) or a `<button>`.
 * Keeps the design-system `.btn` class contract in one place.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  className,
  to,
  href,
  type = 'button',
  disabled,
  children,
  ...rest
}) {
  const classes = cn(
    'btn',
    VARIANTS[variant],
    SIZES[size],
    block && 'btn-block',
    loading && 'loading',
    className,
  );

  if (to && !disabled) {
    return (
      <Link className={classes} to={to} {...rest}>
        {children}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type={type} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  );
}
