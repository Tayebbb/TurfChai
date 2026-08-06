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
    </div>
  );
}
