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
    </div>
  );
}
