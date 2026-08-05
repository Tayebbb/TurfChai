import { NavLink } from 'react-router-dom';

/** Mobile tab bar; visible under 820px on `.has-bottomnav` layouts. */
export function BottomNav({ links, trailing }) {
  return (
    <nav className="bottomnav glass" aria-label="Primary">
      <div className="bottomnav-inner">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <span className="ico" aria-hidden="true">
              {link.icon}
            </span>
            {link.label}
          </NavLink>
        ))}
        {trailing}
      </div>
    </nav>
  );
}
