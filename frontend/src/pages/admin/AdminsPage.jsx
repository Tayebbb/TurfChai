import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const ADMINS = [
  {
    id: 'adm_nadia',
    name: 'Nadia Amin (You)',
    initials: 'NA',
    avatarClass: 'avatar',
    avatarStyle: { background: 'var(--danger-soft)', color: 'var(--danger)' },
    role: 'Super Admin',
    roleTone: 'red',
    meta: 'nadia@turfchai.com · Active Now',
    panelStyle: { borderLeft: '3px solid var(--danger)' },
    self: true,
  },
  {
    id: 'adm_farid',
    name: 'Farid Hasan',
    initials: 'FH',
    avatarClass: 'avatar b',
    avatarStyle: undefined,
    role: 'Verification Admin',
    roleTone: 'blue',
    meta: 'farid@turfchai.com · Active 2h ago',
    panelStyle: undefined,
    self: false,
  },
  {
    id: 'adm_tania',
    name: 'Tania Sultana',
    initials: 'TS',
    avatarClass: 'avatar c',
    avatarStyle: undefined,
    role: 'Support Admin',
    roleTone: 'green',
    meta: 'tania@turfchai.com · Active 20m ago',
    panelStyle: undefined,
    self: false,
  },
];

const ADMIN_ROLES = [
  'Verification Admin — Turf Requests & Documents',
  'Support Admin — Player Matchmaking & Disputes',
  'Finance Admin — Revenue & Payouts',
  'Super Admin — Full System Privileges',
];

const PERMISSIONS = [
  { id: 'perm_review', label: 'Review & Approve Turf Requests', defaultOn: true },
  { id: 'perm_listings', label: 'Manage Active Turf Listings', defaultOn: true },
  { id: 'perm_users', label: 'Suspend or Delete Players/Users', defaultOn: false },
  { id: 'perm_reports', label: 'Access Financial & Analytics Reports', defaultOn: false },
];

export default function AdminsPage() {
  const { showToast } = useToast();
  const adminMade = useDisclosure(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ADMIN_ROLES[0]);
  const [permissions, setPermissions] = useState(() =>
    PERMISSIONS.filter((permission) => permission.defaultOn).map((permission) => permission.id),
  );

  const togglePermission = (id) =>
    setPermissions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const handleSubmit = (event) => {
    event.preventDefault();
    adminMade.open();
  };

  return (
    <>
      <PageTitle title="Admin Accounts & Access Control" />

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
            <h1>Admin Accounts &amp; Access Control</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Privileged Management · Only Super Admins can grant or revoke admin access
          </span>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        {/* Current Admins Roster */}
        <section className="liquid-glass" style={{ padding: 24, borderRadius: 24 }}>
          <h3 style={{ marginBottom: 14 }}>Active Administrators (3)</h3>
          <div className="stack-sm">
            {ADMINS.map((admin) => (
              <div className="panel between" key={admin.id} style={admin.panelStyle}>
                <div className="row" style={{ gap: 10 }}>
                  <span className={admin.avatarClass} style={admin.avatarStyle}>
                    {admin.initials}
                  </span>
                  <div>
                    <b className="small">{admin.name}</b>{' '}
                    <span className={`badge ${admin.roleTone} nodot`}>{admin.role}</span>
                    <div className="tiny subtle">{admin.meta}</div>
                  </div>
                </div>
                {admin.self ? null : (
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      onClick={() => showToast('Opening permissions editor...')}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-ghost-danger"
                      type="button"
                      onClick={() => showToast('Admin deactivation logged to audit trail')}
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Add New Admin Form */}
        <section className="liquid-glass" style={{ padding: 24, borderRadius: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Create Admin Account</h3>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="naName">Full Name</label>
              <input
                className="input"
                id="naName"
                placeholder="e.g. Sajid Rahman"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="naEmail">Work Email</label>
              <input
                className="input"
                id="naEmail"
                type="email"
                placeholder="sajid@turfchai.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="naRole">Administrative Role</label>
              <select
                className="select"
                id="naRole"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {ADMIN_ROLES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={{ marginBottom: 6, display: 'block' }}>Granular Permissions</label>
              <div className="stack-sm">
                {PERMISSIONS.map((permission) => (
                  <label className="checkline" style={{ cursor: 'pointer' }} key={permission.id}>
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary btn-block"
              type="submit"
              style={{ marginTop: 14, fontWeight: 700 }}
            >
              Create &amp; Send Invite →
            </button>
          </form>
        </section>
      </div>

      {/* Success Modal */}
      <Overlay
        isOpen={adminMade.isOpen}
        onClose={adminMade.close}
        title="Admin Invitation Sent"
        hideHeader
        className="center"
      >
        <div className="check-anim" aria-hidden="true">
          🛡️
        </div>
        <h3 style={{ marginBottom: 8 }}>Admin Invitation Sent</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>
          An invitation email has been dispatched. The account remains pending until 2FA setup is
          completed.
        </p>
        <div className="stack-sm">
          <Link className="btn btn-primary btn-block" to={paths.admin.activity}>
            View Activity Log Entry →
          </Link>
          <button className="btn btn-tertiary btn-block" type="button" onClick={adminMade.close}>
            Done
          </button>
        </div>
      </Overlay>
    </>
  );
}