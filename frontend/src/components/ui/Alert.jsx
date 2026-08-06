<<<<<<< HEAD
import { cn } from '@/utils/cn';

const ICONS = { info: 'ℹ️', warn: '⚠️', danger: '⛔', ok: '✅' };

/** Inline message block. */
export function Alert({ tone = 'info', icon, title, className, children, ...rest }) {
  return (
    <div className={cn('alert', tone, className)} role={tone === 'danger' ? 'alert' : 'status'} {...rest}>
      <span className="ico" aria-hidden="true">
        {icon ?? ICONS[tone]}
      </span>
      <div>
        {title ? <b>{title}</b> : null}
        {children}
      </div>
=======
export function Alert({ children, tone = "ok", icon = "🏅", className = "" }) {
  return (
    <div className={`alert ${tone} ${className}`.trim()}>
      {icon && <span className="ico">{icon}</span>}
      <div>{children}</div>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    </div>
  );
}
