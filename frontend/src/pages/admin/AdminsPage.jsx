import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { getUser } from '@/api/client';
import { appointAdmin, deactivateAdmin, listAdmins, updateAdminPermissions } from '@/api/admin';

const ADMIN_ROLE_OPTIONS = [
  { value: 'VERIFICATION', label: 'Verification Admin — Turf Requests & Documents', tone: 'blue' },
  { value: 'SUPPORT', label: 'Support Admin — Player Matchmaking & Disputes', tone: 'green' },
  { value: 'FINANCE', label: 'Finance Admin — Revenue & Payouts', tone: 'yellow' },
];

const ROLE_LABELS = {
  SUPER: 'Super Admin',
  VERIFICATION: 'Verification Admin',
  SUPPORT: 'Support Admin',
  FINANCE: 'Finance Admin',
};

const ROLE_TONES = {
  SUPER: 'red',
  VERIFICATION: 'blue',
  SUPPORT: 'green',
  FINANCE: 'yellow',
};

const PERMISSIONS = [
  { id: 'perm_review', label: 'Review & Approve Turf Requests' },
  { id: 'perm_listings', label: 'Manage Active Turf Listings' },
  { id: 'perm_users', label: 'Suspend or Delete Players/Users' },
  { id: 'perm_reports', label: 'Access Financial & Analytics Reports' },
];

export default function AdminsPage() {
  const { showToast } = useToast();
  const adminMade = useDisclosure(false);
  const editOpen = useDisclosure(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ADMIN_ROLE_OPTIONS[0].value);
  const [permissions, setPermissions] = useState(() =>
    PERMISSIONS.filter((permission) => ['perm_review', 'perm_listings'].includes(permission.id)).map((permission) => permission.id),
  );

  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = getUser()?.role === 'SUPER_ADMIN';

  const loadAdmins = async () => {
    setLoading(true);
    try {
      setAdmins(await listAdmins());
    } catch (error) {
      showToast(error?.message || 'Failed to load admins', { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePermission = (id) =>
    setPermissions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const toggleEditPermission = (id) =>
    setEditPermissions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const selectedPermissions = Object.fromEntries(
        PERMISSIONS.map((permission) => [permission.id, permissions.includes(permission.id)]),
      );
      await appointAdmin({
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        temporaryPassword: password,
        adminRole: role,
        permissions: selectedPermissions,
      });
      adminMade.open();
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole(ADMIN_ROLE_OPTIONS[0].value);
      setPermissions(['perm_review', 'perm_listings']);
      await loadAdmins();
    } catch (error) {
      showToast(error?.message || 'Could not appoint admin', { duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPermissions = (admin) => {
    setEditingAdmin(admin);
    setEditPermissions(PERMISSIONS.filter((permission) => admin.permissions?.[permission.id]).map((permission) => permission.id));
    editOpen.open();
  };

  const handleSavePermissions = async () => {
    if (!editingAdmin) return;
    const selectedPermissions = Object.fromEntries(
      PERMISSIONS.map((permission) => [permission.id, editPermissions.includes(permission.id)]),
    );
    try {
      await updateAdminPermissions(editingAdmin.id, selectedPermissions);
      editOpen.close();
      showToast(`Permissions updated for ${editingAdmin.fullName}`);
      await loadAdmins();
    } catch (error) {
      showToast(error?.message || 'Could not update permissions', { duration: 5000 });
    }
  };

  const handleDeactivate = async (admin) => {
    try {
      await deactivateAdmin(admin.id);
      showToast(`${admin.fullName} deactivated · logged to audit trail`);
      await loadAdmins();
    } catch (error) {
      showToast(error?.message || 'Could not deactivate admin', { duration: 5000 });
    }
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
          <h3 style={{ marginBottom: 14 }}>Active Administrators ({admins.length})</h3>
          {loading ? (
            <div className="subtle small" style={{ padding: 12 }}>
              Loading administrators…
            </div>
          ) : (
            <div className="stack-sm">
              {admins.map((admin) => (
                <div
                  className="panel between"
                  key={admin.id}
                  style={admin.isSelf ? { borderLeft: '3px solid var(--danger)' } : undefined}
                >
                  <div className="row" style={{ gap: 10 }}>
                    <span className={`avatar ${admin.isSelf ? '' : 'b'}`}>{admin.avatarInitials ?? '??'}</span>
                    <div>
                      <b className="small">
                        {admin.fullName}
                        {admin.isSelf ? ' (You)' : ''}
                      </b>{' '}
                      <span className={`badge ${ROLE_TONES[admin.adminRole] ?? 'gray'} nodot`}>
                        {ROLE_LABELS[admin.adminRole] ?? admin.adminRole}
                      </span>
                      <div className="tiny subtle">
                        {admin.email} · {admin.status === 'ACTIVE' ? 'Active' : admin.status === 'DISABLED' ? 'Disabled' : 'Invited'}
                      </div>
                    </div>
                  </div>
                  {admin.isSelf ? null : (
                    <div className="row" style={{ gap: 6 }}>
                      {isSuperAdmin && (
                        <>
                          <button
                            className="btn btn-sm btn-secondary"
                            type="button"
                            onClick={() => handleEditPermissions(admin)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-ghost-danger"
                            type="button"
                            onClick={() => handleDeactivate(admin)}
                          >
                            Deactivate
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add New Admin Form */}
        <section className="liquid-glass" style={{ padding: 24, borderRadius: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Create Admin Account</h3>
          <span className="subtle small" style={{ display: 'block', marginBottom: 12 }}>
            The Super Admin role is reserved for the platform&rsquo;s single owner account.
          </span>
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
              <label htmlFor="naPhone">Phone</label>
              <input
                className="input"
                id="naPhone"
                type="tel"
                placeholder="+880 1XXX XXX XXX"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="naPassword">Temporary Password</label>
              <input
                className="input"
                id="naPassword"
                type="text"
                placeholder="Min 8 characters — share securely"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                {ADMIN_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
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
              disabled={submitting || !isSuperAdmin}
            >
              {submitting ? 'Creating…' : 'Create & Send Invite →'}
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
          The admin account is active. Share the temporary password securely and ask them to change it
          after first sign-in.
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

      {/* Permissions Editor */}
      <Overlay
        isOpen={editOpen.isOpen}
        onClose={editOpen.close}
        title={`Edit Permissions — ${editingAdmin?.fullName ?? ''}`}
        className="center"
      >
        <div className="stack-sm" style={{ margin: '14px 0 18px' }}>
          {PERMISSIONS.map((permission) => (
            <label className="checkline" style={{ cursor: 'pointer' }} key={permission.id}>
              <input
                type="checkbox"
                checked={editPermissions.includes(permission.id)}
                onChange={() => toggleEditPermission(permission.id)}
              />
              <span>{permission.label}</span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-block" type="button" onClick={handleSavePermissions}>
            Save Permissions
          </button>
          <button className="btn btn-tertiary btn-block" type="button" onClick={editOpen.close}>
            Cancel
          </button>
        </div>
      </Overlay>
    </>
  );
}
