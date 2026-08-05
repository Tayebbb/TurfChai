// Import `Link` from react-router-dom — an anchor that navigates client-side without a full page reload.
import { Link } from 'react-router-dom';
// Import the `cn` utility (classnames helper) so we can conditionally merge/append className strings.
import { cn } from '@/utils/cn';

/** Airbnb-style multi-cell search block used on the landing hero. */
export function SearchBar({ cells = [], action, className }) {
  // `cells` = array of {label, value} entries (defaults to [] if omitted), `action` = a button/element passed in by the parent.
  return (
    // cn() merges the base classes ("searchbar glass") with any extra className the parent supplies.
    // role="search" marks this div as a search region for assistive tech.
    <div className={cn('searchbar glass', className)} role="search">
      {/* Loop over every search cell (e.g. "Location / Anywhere", "Guests / 2 adults")… */}
      {cells.map((cell) => (
        // `key={cell.label}` gives React a stable identity per cell for efficient re-renders.
        <div className="cell" key={cell.label}>
          {/* Label shown as the small grey caption above the value… */}
          <span>{cell.label}</span>
          {/* Value shown as the bolded current selection */}
          <b>{cell.value}</b>
        </div>
      ))}
      {/* Renders whatever element the parent passes as `action` — typically a search button */}
      <div className="go">{action}</div>
    </div>
  );
}

/** Collapsed single-line search entry point. */
export function SearchCompact({ to, placeholder, highlight, label = 'Search', className }) {
  return (
    // Renders as a Link so clicking the collapsed bar navigates `to` the full search page.
    // aria-label overrides the accessible name; cn() merges base + extra classes.
    <Link className={cn('search-compact glass', className)} to={to} aria-label={label}>
      {/* Decorative magnifier icon — hidden from screen readers with aria-hidden */}
      <span aria-hidden="true">🔍</span>
      <span>
        {/* Show the placeholder text, then optionally a muted highlight snippet (e.g. the chosen dates) */}
        {placeholder} {highlight ? <b className="muted">{highlight}</b> : null}
      </span>
    </Link>
  );
}
