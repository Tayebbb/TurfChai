import { Link } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';

export function DashHeader({ title, subtitle, action }) {
  return (
    <div className="dash-head between" style={{ gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DashCard({ title, action, children, ...rest }) {
  return (
    <section className="dash-card" {...rest}>
      {title || action ? (
        <div className="dash-card-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DashEmpty({ icon = '✦', title, children, actions }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-ico" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {actions ? <div className="dash-empty-actions">{actions}</div> : null}
    </div>
  );
}

export function DashSkeleton({ rows = 3, height = 62 }) {
  return (
    <div className="dash-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="dash-skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function DashError({ message = 'Something went wrong loading this section.', onRetry }) {
  return (
    <DashEmpty
      icon="⚠"
      title="Couldn’t load this"
      actions={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    >
      {message}
    </DashEmpty>
  );
}

export function DashLink({ to, children }) {
  return <Link to={to}>{children}</Link>;
}
