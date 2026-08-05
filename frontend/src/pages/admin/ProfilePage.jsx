import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { currentAdmin } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './ProfilePage.css';

const TIMEZONES = ['Dhaka (GMT+6)', 'London (GMT+0)', 'New York (GMT-5)'];

const PROFILE_STATS = [
  { id: 'since', label: 'USER SINCE', value: 'Feb 2024', style: undefined },
  { id: 'actions', label: 'LOGGED ACTIONS', value: '1,204 Actions', style: undefined },
  { id: 'security', label: 'SECURITY LEVEL', value: 'High (2FA)', style: { color: 'var(--mint)' } },
];

const RECENT_ACTIVITY = [
  { id: 'act-1', title: 'Suspended user #38112', when: 'Today 4:02 PM' },
  { id: 'act-2', title: 'Updated turf venue V-0044', when: 'Yesterday' },
  { id: 'act-3', title: 'Approved TR-1033 · Mirpur Annex', when: '2 days ago' },
];

export default function ProfilePage() {
  const { showToast } = useToast();
  const profileSaved = useDisclosure(false);
  const [name, setName] = useState(currentAdmin.name);
  const [email, setEmail] = useState('nadia@turfchai.com');
  const [phone, setPhone] = useState('+880 1700 112 233');
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  const handleSubmit = (event) => {
    event.preventDefault();
    profileSaved.open();
  };

  return (
    <>
      <PageTitle title="My Admin Account & Settings" />

      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Link
              className="btn btn-sm btn-tertiary"
              to={paths.admin.dashboard}
              style={{ padding: '4px 10px', fontWeight: 700 }}
            >
              ← Back
            </Link>
            <h1>My Account &amp; Settings</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Manage your administrative credentials and security logs
          </span>
        </div>
      </div>

      {/* Header Card (Summary) */}
      <div className="profile-header-card">
        <div className="profile-avatar-wrap">
          {currentAdmin.initials}
          <span className="status-indicator"></span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="row-wrap" style={{ alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{currentAdmin.name}</h2>
            <span className="badge red nodot">{currentAdmin.role}</span>
          </div>
          <span className="subtle small" style={{ display: 'block', marginTop: 2 }}>
            Primary workspace account
          </span>

          <div className="stat-mini-row">
            {PROFILE_STATS.map((stat, index) => (
              <Fragment key={stat.id}>
                {index > 0 ? (
                  <div style={{ width: 1, background: 'var(--border-soft)' }}></div>
                ) : null}
                <div className="stat-mini-item">
                  <span className="subtle tiny" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                    {stat.label}
                  </span>
                  <b style={{ fontSize: 14, fontFamily: 'var(--font-display)', ...stat.style }}>
                    {stat.value}
                  </b>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: 'start', gap: 24 }}>
        {/* Left Column: Profile Information Form */}
        <section className="card" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
            Personal Information
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="pfName">Full Name</label>
              <input
                className="input"
                id="pfName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pfEmail">Work Email</label>
              <input
                className="input"
                id="pfEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pfPhone">Phone Contact</label>
              <input
                className="input num"
                id="pfPhone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pfTimezone">Preferred Timezone</label>
              <select
                className="select"
                id="pfTimezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              style={{ marginTop: 16, fontWeight: 700, minHeight: 42, padding: '0 24px' }}
            >
              Save Settings Updates
            </button>
          </form>
        </section>

        {/* Right Column: Security Credentials & Activity */}
        <div className="stack" style={{ gap: 24 }}>
          <section className="card" style={{ padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
              Security Credentials
            </h3>
            <div className="stack-sm" style={{ gap: 12 }}>
              <div
                className="panel between"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border-soft)',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div>
                  <b className="small" style={{ color: 'var(--text)' }}>
                    Password
                  </b>
                  <div className="tiny subtle" style={{ marginTop: 2 }}>
                    Last changed 42 days ago
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => showToast('Password change flow initiated 🔒')}
                >
                  Change Password
                </button>
              </div>

              <div
                className="panel between"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border-soft)',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div>
                  <b className="small" style={{ color: 'var(--text)' }}>
                    Two-Factor Authentication (2FA)
                  </b>
                  <div className="tiny subtle" style={{ marginTop: 2 }}>
                    Authenticator App (Required)
                  </div>
                </div>
                <span className="badge green nodot">Enabled ✓</span>
              </div>

              <div
                className="panel between"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border-soft)',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div>
                  <b className="small" style={{ color: 'var(--text)' }}>
                    Active Admin Sessions
                  </b>
                  <div className="tiny subtle" style={{ marginTop: 2 }}>
                    2 Devices (Chrome Windows, Mobile App)
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost-danger"
                  type="button"
                  onClick={() => showToast('Other sessions terminated')}
                >
                  Revoke Others
                </button>
              </div>
            </div>
          </section>

          {/* Recent Log Activity */}
          <section className="card" style={{ padding: 24, borderRadius: 20 }}>
            <div className="between" style={{ marginBottom: 16, alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>My Recent Activity</h3>
              <Link
                className="btn btn-sm btn-tertiary"
                to={paths.admin.activity}
                style={{ fontWeight: 700 }}
              >
                Full History →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {RECENT_ACTIVITY.map((item, index) => (
                <div
                  className="tline-item"
                  key={item.id}
                  style={index === RECENT_ACTIVITY.length - 1 ? { marginBottom: 0 } : undefined}
                >
                  <b className="small" style={{ color: 'var(--text)' }}>
                    {item.title}
                  </b>
                  <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                    {item.when}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Saved Confirmation Modal */}
      <Overlay
        isOpen={profileSaved.isOpen}
        onClose={profileSaved.close}
        title="Profile Updated"
        hideHeader
        className="center"
      >
        <div className="check-anim" aria-hidden="true">
          ✓
        </div>
        <h3 style={{ marginBottom: 8 }}>Profile Updated</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Your personal administrative profile settings have been updated.
        </p>
        <button className="btn btn-primary btn-block" type="button" onClick={profileSaved.close}>
          Done
        </button>
      </Overlay>
    </>
  );
}