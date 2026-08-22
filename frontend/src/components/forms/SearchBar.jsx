import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Airbnb-style multi-cell search block used on the landing hero. */
export function SearchBar({ cells = [], action, className }) {
  return (
    <div className={cn('searchbar glass', className)} role="search">
      {cells.map((cell) => (
        <div className="cell" key={cell.label}>
          <span>{cell.label}</span>
          <b>{cell.value}</b>
        </div>
      ))}
      <div className="go">{action}</div>
    </div>
  );
}

/** Interactive search bar on the player home dashboard. */
export function SearchCompact({
  to = '/player/explore',
  placeholder = 'Turf, sport, or area…',
  label = 'Search venues',
  className,
  defaultValue = '',
  onSearch,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    if (onSearch) {
      onSearch(trimmed);
      return;
    }
    const targetPath = to || '/player/explore';
    const destination = `${targetPath}${targetPath.includes('?') ? '&' : '?'}q=${encodeURIComponent(trimmed)}`;
    navigate(destination);
  };

  return (
    <form
      className={cn('search-compact-form glass', className)}
      role="search"
      aria-label={label}
      onSubmit={handleSubmit}
    >
      <button
        type="submit"
        className="search-compact-btn-icon"
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true">🔍</span>
      </button>
      <input
        type="text"
        className="search-compact-input"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={label}
      />
    </form>
  );
}
