import { NavLink, Outlet } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { getMyProfile } from '@/api/players';
import { getUser } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { DASHBOARD_SECTIONS, profileCompletion } from './sections';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const me = useApi(() => getMyProfile(), []);
  const localUser = getUser();
  const fullName = localUser?.fullName || me.data?.fullName || 'Player';
  const profile = me.data ? { ...me.data, fullName } : localUser;
  const completion = profileCompletion(profile);

  const initials =
    profile?.avatarInitials ||
    (fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <>
      <PageTitle title="Dashboard" />
      <div className="wrap dash-wrap" id="main">
        <aside className="dash-side" aria-label="Dashboard sections">
          <div className="dash-me">
            <span className="dash-avatar" aria-hidden="true">
              {initials || '·'}
            </span>
            <div className="dash-me-text">
              <b>{profile?.fullName ?? (me.loading ? 'Loading…' : 'Your profile')}</b>
              <span>{profile?.area ?? ''}</span>
            </div>
          </div>

          {profile && completion.percent < 100 ? (
            <NavLink to={paths.player.dashboard.settings} className="dash-completion">
              <div className="dash-completion-top">
                <span>Profile {completion.percent}%</span>
                <b>Complete it →</b>
              </div>
              <div className="dash-bar">
                <i style={{ width: `${completion.percent}%` }} />
              </div>
            </NavLink>
          ) : null}

          <nav className="dash-nav">
            {DASHBOARD_SECTIONS.map((section) => (
              <NavLink
                key={section.path}
                to={section.path}
                end={section.end}
                className={({ isActive }) => (isActive ? 'dash-link is-active' : 'dash-link')}
              >
                <span className="dash-ico" aria-hidden="true">
                  {section.icon}
                </span>
                <span className="dash-label">{section.label}</span>
                {section.pending ? (
                  <span className="dash-soon" title="Waiting on its service">
                    soon
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="dash-main">
          <Outlet context={{ profile, completion, profileState: me }} />
        </main>
      </div>
    </>
  );
}
