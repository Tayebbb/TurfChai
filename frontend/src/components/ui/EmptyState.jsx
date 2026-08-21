import { cn } from '@/utils/cn';

/** Zero-state block with an optional call to action. */
export function EmptyState({ glyph = '🗓️', title, description, action, className, style }) {
  return (
    <div className={cn('empty', className)} style={style}>
      <div className="glyph" aria-hidden="true">
        {glyph}
      </div>
      {title ? <h3>{title}</h3> : null}
      {description ? <p className="small">{description}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}
