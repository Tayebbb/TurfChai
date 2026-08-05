import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { paths } from '@/routes/paths';

const MARK = (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path
      d="M16 2.5C9.6 2.5 4.5 7.6 4.5 14c0 8.2 11.5 15.5 11.5 15.5S27.5 22.2 27.5 14C27.5 7.6 22.4 2.5 16 2.5z"
      fill="var(--brand)"
    />
    <rect x="10" y="8.5" width="12" height="11" rx="2" fill="none" stroke="#fff" strokeWidth="1.5" />
    <line x1="16" y1="8.5" x2="16" y2="19.5" stroke="#fff" strokeWidth="1.5" />
    <circle cx="16" cy="14" r="2.2" fill="none" stroke="#fff" strokeWidth="1.5" />
  </svg>
);

/** Wordmark + pin logo. `badge` renders the role chip (Owner, Super Admin…). */
export function Brand({ to = paths.landing, size = 28, badge, className }) {
  return (
    <Link className={cn('brand', className)} to={to}>
      <span style={{ width: size, height: size, display: 'block' }}>{MARK}</span>
      TurfChai
      {badge ? <span style={{ marginLeft: 6 }}>{badge}</span> : null}
    </Link>
  );
}
