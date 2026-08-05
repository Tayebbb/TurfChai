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
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>My Account &amp; Settings</h1>
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
