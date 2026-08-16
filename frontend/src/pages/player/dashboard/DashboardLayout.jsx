import { NavLink, Outlet } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { getMyProfile } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { paths } from '@/routes/paths';
import { DASHBOARD_SECTIONS, profileCompletion } from './sections';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const session = useSession();
  // Preferences (skill level, sports, times) only exist on the player profile,
  // and only this dashboard and onboarding read them — so it is fetched here
  // rather than on every page in the app.
  const playerApi = useApi(
    () => (session.signedIn ? getMyProfile() : Promise.resolve(null)),
    [session.signedIn],
  );
  const profile = playerApi.data ? { ...session.user, ...playerApi.data } : session.user;
  const fullName = profile?.fullName || 'Player';
  const completion = profileCompletion(profile);
  const profileState = { loading: playerApi.loading, error: playerApi.error, reload: playerApi.reload };

  const initials =
    (fullName ?? '').split(/\s+/).filter(Boolean).length === 1
      ? (fullName ?? '').trim().slice(0, 2).toUpperCase()
      : (fullName ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join('') || '·';

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
              <b>{profile?.fullName ?? (session.loading ? 'Loading…' : 'Your profile')}</b>
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
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="dash-main">
          <Outlet context={{ profile, completion, profileState }} />
        </main>
      </div>
    </>
  );
}
