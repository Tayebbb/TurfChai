import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { getMe, updateMe } from '@/api/auth';
import { getUser, setSession, api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './ProfilePage.css';

const TIMEZONES = ['Dhaka (GMT+6)', 'London (GMT+0)', 'New York (GMT-5)'];

const fallbackInitials = (fullName) => {
  if (!fullName) return '??';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function ProfilePage() {
  const { showToast } = useToast();
  const profileSaved = useDisclosure(false);
  const stored = getUser() ?? {};
  const [user, setUser] = useState(stored);
  const [name, setName] = useState(stored.fullName ?? '');
  const [email, setEmail] = useState(stored.email ?? '');
  const [phone, setPhone] = useState(stored.phone ?? '');
  const [timezone, setTimezone] = useState(stored.timezone ?? TIMEZONES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe()
      .then((fresh) => {
        setUser(fresh);
        setName(fresh.fullName ?? '');
        setEmail(fresh.email ?? '');
        setPhone(fresh.phone ?? '');
        setSession({ user: fresh });
      })
      .catch(() => {
        // Session lookup failed — keep showing the stored session user.
      });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMe({ fullName: name.trim(), email: email.trim(), phone: phone.trim() });
      const current = getUser() ?? {};
      setSession({ user: { ...current, ...updated, timezone } });
      setUser(updated);
      setEmail(updated.email);
      setPhone(updated.phone);
      profileSaved.open();
    } catch (error) {
      showToast(error.message || 'Failed to save your profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = user.avatarInitials || fallbackInitials(user.fullName);
  const role = user.role || 'ADMIN';

  const { data: auditRes } = useApi(() => api('/admin/audit-log?page=0&size=5'), []);
  const auditEntries = auditRes?.data?.content || auditRes?.content || [];

  const recentActivity = auditEntries.map((entry) => {
    const when = entry.createdAt
      ? new Date(entry.createdAt).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
      : '';
    return {
      id: String(entry.id),
      title: `${entry.target ? entry.target + ' · ' : ''}${entry.action}`,
      when,
    };
  });

  const profileStats = [
    {
      id: 'since',
      label: 'USER SINCE',
      value: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
      style: undefined,
    },
    { id: 'actions', label: 'RECENT ACTIONS', value: `${auditEntries.length} in log`, style: undefined },
    { id: 'security', label: 'SECURITY LEVEL', value: 'High (2FA)', style: { color: 'var(--mint)' } },
  ];

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
          {initials}
          <span className="status-indicator"></span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="row-wrap" style={{ alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{user.fullName || '—'}</h2>
            <span className="badge red nodot">{role}</span>
          </div>
          <span className="subtle small" style={{ display: 'block', marginTop: 2 }}>
            {user.email || 'Primary workspace account'}
          </span>

          <div className="stat-mini-row">
            {profileStats.map((stat, index) => (
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
              disabled={saving}
              style={{ marginTop: 16, fontWeight: 700, minHeight: 42, padding: '0 24px' }}
            >
              {saving ? 'Saving…' : 'Save Settings Updates'}
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
                    Secured with hashed credentials
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
                    Sessions managed centrally
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent Platform Activity</h3>
              <Link
                className="btn btn-sm btn-tertiary"
                to={paths.admin.activity}
                style={{ fontWeight: 700 }}
              >
                Full History →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentActivity.length === 0 ? (
                <div className="tiny subtle" style={{ padding: '10px 0', display: 'block' }}>
                  No recent activity logged yet.
                </div>
              ) : recentActivity.map((item, index) => (
                <div
                  className="tline-item"
                  key={item.id}
                  style={index === recentActivity.length - 1 ? { marginBottom: 0 } : undefined}
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
          Your personal profile settings have been saved.
        </p>
        <button className="btn btn-primary btn-block" type="button" onClick={profileSaved.close}>
          Done
        </button>
      </Overlay>
    </>
  );
}