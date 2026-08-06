<<<<<<< HEAD
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Vertically-spaced page section. */
export function Section({ as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag className={cn('section', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Heading row with an optional trailing action link. */
export function SectionTitle({ title, action, actionTo, actionHref, children, className }) {
  return (
    <div className={cn('section-title', className)}>
      <h2>{title}</h2>
      {actionTo ? <Link to={actionTo}>{action}</Link> : null}
      {actionHref ? <a href={actionHref}>{action}</a> : null}
      {!actionTo && !actionHref ? children : null}
    </div>
  );
}

/** Centred marketing heading used on the landing page. */
export function SectionHead({ title, subtitle, className }) {
  return (
    <div className={cn('section-head', className)}>
      <h2>{title}</h2>
      {subtitle ? <p className="sub">{subtitle}</p> : null}
=======
export function Section({ children, title, subtitle, className = "", ...props }) {
  return (
    <section className={`section ${className}`.trim()} style={{ margin: "24px 0" }} {...props}>
      {title && <SectionHead title={title} subtitle={subtitle} />}
      {children}
    </section>
  );
}

export function SectionHead({ title, subtitle, className = "" }) {
  return (
    <div className={`section-head ${className}`.trim()} style={{ marginBottom: 12 }}>
      {title && <h2 style={{ fontSize: "1.25rem" }}>{title}</h2>}
      {subtitle && <p className="small muted">{subtitle}</p>}
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
    </div>
  );
}
