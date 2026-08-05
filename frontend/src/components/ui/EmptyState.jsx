import { cn } from '@/utils/cn';

/** Zero-state block with an optional call to action. */
export function EmptyState({ glyph = '🗓️', title, description, action, className }) {
  return (
    <div className={cn('empty', className)}>
      <div className="glyph" aria-hidden="true">
        {glyph}
      </div>
      {title ? <h3>{title}</h3> : null}
      {description ? <p className="small">{description}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}
