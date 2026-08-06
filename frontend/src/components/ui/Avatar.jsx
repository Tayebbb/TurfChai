<<<<<<< HEAD
import { cn } from '@/utils/cn';
import { initials as toInitials } from '@/utils/format';

/** Initial-based avatar. `tone` picks one of the palette variants (b/c/d). */
export function Avatar({ name, initials, size = 'md', tone, className, ...rest }) {
  const label = initials ?? toInitials(name);
  const sizeClass = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : '';

  return (
    <span className={cn('avatar', sizeClass, tone, className)} title={name} {...rest}>
      {label}
    </span>
  );
}

export function AvatarGroup({ className, children, ...rest }) {
  return (
    <div className={cn('avatar-group', className)} {...rest}>
      {children}
=======
export function Avatar({ name, initials, size = "md", tone, className = "" }) {
  const sizeClass = size ? `avatar-${size}` : "";
  const toneClass = tone ? `tone-${tone}` : "";
  return (
    <div className={`avatar ${sizeClass} ${toneClass} ${className}`.trim()}>
      {initials || (name ? name.substring(0, 2).toUpperCase() : "?")}
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    </div>
  );
}
