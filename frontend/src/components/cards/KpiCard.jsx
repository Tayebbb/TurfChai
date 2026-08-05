import { cn } from '@/utils/cn';

/** Dashboard metric tile. `trend` is 'up' | 'down' | undefined. */
export function KpiCard({ label, value, delta, trend, className, children, ...rest }) {
  return (
    <div className={cn('kpi', className)} {...rest}>
      <span className="label">{label}</span>
      <b className="value num">{value}</b>
      {delta ? <span className={cn('delta', trend)}>{delta}</span> : null}
      {children}
    </div>
  );
}

/** Miniature bar sparkline rendered from 0–1 ratios. */
export function SparkBar({ values = [], className }) {
  return (
    <div className={cn('spark-bar', className)} aria-hidden="true">
      {values.map((value, index) => (
        <div key={index} style={{ height: `${Math.max(6, value * 100)}%` }} />
      ))}
    </div>
  );
}