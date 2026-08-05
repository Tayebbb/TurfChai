import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Sticky glass header. Children fill the right-hand action area. */
export function Topbar({ brand, links, leading, innerStyle, children, className }) {
  return (
    <header className={cn('topbar glass', className)}>
      <div className="topbar-inner" style={innerStyle}>
        {leading}
        {brand}
        {links?.length ? (
          <nav className="navlinks" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
        <div className="spacer" />
        {children}
      </div>
    </header>
  );
}
