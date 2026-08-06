<<<<<<< HEAD
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
=======
import { Link } from "react-router-dom";

export function Button({
  children,
  variant = "primary",
  size,
  block = false,
  to,
  className = "",
  disabled,
  onClick,
  ...props
}) {
  const baseClass = "btn";
  const variantClass = variant ? `btn-${variant}` : "";
  const sizeClass = size ? `btn-${size}` : "";
  const blockClass = block ? "btn-block" : "";
  const combinedClasses = `${baseClass} ${variantClass} ${sizeClass} ${blockClass} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={combinedClasses} {...props}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
        {children}
      </Link>
    );
  }

<<<<<<< HEAD
  if (href && !disabled) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type={type} disabled={disabled || loading} {...rest}>
=======
  return (
    <button
      type="button"
      className={combinedClasses}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </button>
  );
}
