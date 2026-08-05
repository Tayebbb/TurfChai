import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Trail of ancestor links. Items: `{ label, to? }`. */
export function Breadcrumbs({ items, className }) {
  return (
    <nav className={cn('breadcrumbs', className)} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? (
            <span className="sep" aria-hidden="true">
              /
            </span>
          ) : null}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
