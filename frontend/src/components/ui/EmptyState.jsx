<<<<<<< HEAD
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
=======
export function EmptyState({ icon = "🔍", title = "Nothing found", description, action }) {
  return (
    <div className="empty-state center" style={{ padding: "40px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {description && <p className="muted small" style={{ marginBottom: 16 }}>{description}</p>}
      {action}
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    </div>
  );
}
