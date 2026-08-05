import { cn } from '@/utils/cn';

/** Vertical activity feed. Items: `{ id, title, when, state? }`. */
export function Timeline({ items, className }) {
  return (
    <ul className={cn('tline', className)}>
      {items.map((item) => (
        <li key={item.id} className={item.state}>
          <b>{item.title}</b>
          {item.description ? (
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              {item.description}
            </p>
          ) : null}
          {item.when ? <div className="when">{item.when}</div> : null}
        </li>
      ))}
    </ul>
  );
}
