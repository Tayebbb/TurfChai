import { NavLink } from 'react-router-dom';
import { useSidebar } from '@/hooks/useSidebar';

/** Owner console side navigation plus its mobile backdrop. */
export function Sidebar({ links, label = 'Workspace' }) {
  const { closeDrawer } = useSidebar();

  return (
    <>
      <aside className="sidebar">
        <nav className="sidenav" aria-label={label}>
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
        </nav>
      </aside>
      <div className="sidebar-backdrop" onClick={closeDrawer} aria-hidden="true" />
    </>
  );
}
