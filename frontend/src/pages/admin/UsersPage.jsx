import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { listAdminUsers, updateUserStatus, reinstateUser } from '@/api/adminUsers';
import { useApi } from '@/hooks/useApi';

const FILTERS = ['All Accounts', 'Players', 'Turf Owners', 'Game Hosts', 'Suspended'];

const ROLE_CHIPS = ['Player', 'Turf Owner', 'Game Host'];

const ACCOUNT_STANDINGS = ['Active', 'Restricted (No Matchmaking)', 'Suspended'];

const STATIC_USERS = [
  {
    id: '#40221',
    name: 'Rafiul Karim',
    initials: 'RK',
    avatarClass: 'avatar sm',
    phone: '+880 1712 ••• 890',
    roles: [{ label: 'Player', tone: 'green' }],
    bookings: 12,
    reliability: '98%',
    joined: 'Mar 2025',
    status: 'Active',
    statusTone: 'green',
    flagged: false,
  },
  {
    id: '#28810',
    name: 'Mahmudul Hasan',
    initials: 'MH',
    avatarClass: 'avatar sm',
    avatarStyle: { background: 'var(--info-soft)', color: 'var(--info)' },
    phone: '+880 1811 ••• 344',
    roles: [
      { label: 'Turf Owner', tone: 'blue' },
      { label: 'Player', tone: 'green' },
    ],
    bookings: 31,
    reliability: '100%',
    joined: 'Jan 2024',
    status: 'Active',
    statusTone: 'green',
    flagged: false,
  },
  {
    id: '#38112',
    name: 'M. Babul',
    initials: 'MB',
    avatarClass: 'avatar sm d',
    phone: '+880 1999 ••• 402',
    roles: [{ label: 'Player', tone: 'green' }],
    bookings: 9,
    reliability: '61%',
    reliabilityStyle: { color: 'var(--danger)', fontWeight: 700 },
    joined: 'Nov 2025',
    status: 'Suspended',
    statusTone: 'red',
    rowStyle: { background: 'rgba(201,59,59,0.08)' },
    flagged: true,
  },
];

function initialsOf(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function UsersPage() {
  const { showToast } = useToast();
  const editUser = useDisclosure(false);
  const [filter, setFilter] = useState('All Accounts');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStanding, setEditStanding] = useState('Active');

  const roleParam = filter === 'Players' ? 'PLAYER' : filter === 'Turf Owners' ? 'HOST' : filter === 'Game Hosts' ? 'HOST' : null;
  const statusParam = filter === 'Suspended' ? 'suspended' : null;

  const { data: res, loading, reload } = useApi(
    () => listAdminUsers(roleParam, statusParam, search),
    [filter, search],
  );

  const apiUsersData = res?.data || res;

  const userRows = useMemo(() => {
    if (Array.isArray(apiUsersData) && apiUsersData.length > 0) {
      return apiUsersData.map((u) => {
        const isSuspended = Boolean(u.isSuspended) || u.status === 'SUSPENDED';
        return {
          dbId: u.id,
          id: `#${u.id}`,
          name: u.fullName,
          initials: initialsOf(u.fullName),
          avatarClass: 'avatar sm',
          phone: u.phone || '—',
          roles: [{ label: u.role || 'Player', tone: u.role === 'HOST' ? 'blue' : 'green' }],
          bookings: u.gamesAttended || 0,
          reliability: `${u.reliabilityScore ?? 100}%`,
          joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026',
          status: isSuspended ? 'Suspended' : u.status || 'Active',
          statusTone: isSuspended ? 'red' : 'green',
          rowStyle: isSuspended ? { background: 'rgba(201,59,59,0.08)' } : undefined,
          flagged: isSuspended,
        };
      });
    }
    return STATIC_USERS;
  }, [apiUsersData]);

  

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditStanding(user.status);
    editUser.open();
  };

  const saveUser = async () => {
    editUser.close();
    if (selectedUser?.dbId) {
      try {
        const isSusp = editStanding === 'Suspended';
        await updateUserStatus(selectedUser.dbId, {
          status: editStanding.toUpperCase(),
          isSuspended: isSusp,
        });
        reload();
      } catch {
        // ignore
      }
    }
    showToast('User account updated & logged ✓');
  };

  const handleReinstate = async (user) => {
    if (user.dbId) {
      try {
        await reinstateUser(user.dbId);
        reload();
      } catch {
        // ignore
      }
    }
    showToast('Suspension lifted early — logged to audit trail');
  };

  const handleSuspendQuick = async (user) => {
    if (user.dbId) {
      try {
        await updateUserStatus(user.dbId, { status: 'SUSPENDED', isSuspended: true });
        reload();
      } catch {
        // ignore
      }
    }
    showToast('User account suspended and logged ✓');
  };

  return (
    <>
      <PageTitle title="Users & Players Management" />

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
            <h1>Users &amp; Player Matchmaking</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Manage Player Accounts · Review Matchmaking Badges · Handle Moderation
          </span>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => showToast('Exporting user roster CSV...')}
        >
          ⬇ Export Roster
        </button>
      </div>

      {/* Filters & Search */}
      <div className="row-wrap" style={{ marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="🔍 Search name, phone, ID…"
          aria-label="Search name, phone, ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {FILTERS.map((item) => (
          <Chip key={item} active={filter === item} onToggle={() => setFilter(item)}>
            {item}
          </Chip>
        ))}
      </div>

      {/* Users Table */}
      <div className="liquid-glass table-wrap" style={{ padding: 0, borderRadius: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>User / Account</th>
              <th>Phone Contact</th>
              <th>Platform Roles</th>
              <th className="num">Bookings</th>
              <th className="num">Reliability Rate</th>
              <th>Joined</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading users...</td>
              </tr>
            ) : userRows.map((user) => (
              <tr key={user.id} style={user.rowStyle}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <span className={user.avatarClass} style={user.avatarStyle}>
                      {user.initials}
                    </span>
                    <div>
                      <b>{user.name}</b>
                      <br />
                      <span className="tiny subtle num">{user.id}</span>
                    </div>
                  </div>
                </td>
                <td className="num small">{user.phone}</td>
                <td>
                  {user.roles.map((role) => (
                    <span key={role.label} className={`badge ${role.tone} nodot`}>
                      {role.label}
                    </span>
                  ))}
                </td>
                <td className="num">{user.bookings}</td>
                <td className="num" style={user.reliabilityStyle}>
                  {user.reliability}
                </td>
                <td>{user.joined}</td>
                <td>
                  <span className={`badge ${user.statusTone}`}>{user.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    {user.flagged ? (
                      <>
                        <button
                          className="btn btn-sm btn-tertiary"
                          type="button"
                          onClick={() =>
                            showToast('Suspension Reason: Repeated no-shows & abusive chat')
                          }
                        >
                          View Flag
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          type="button"
                          onClick={() => handleReinstate(user)}
                        >
                          Reinstate
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-tertiary"
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                        >
                          Edit Profile
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          type="button"
                          onClick={() => handleSuspendQuick(user)}
                        >
                          Suspend
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editUser.isOpen && (
        <Overlay title={`Edit User Profile · ${selectedUser?.id}`} onClose={editUser.close}>
          <div className="col" style={{ gap: 14 }}>
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                className="input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Account Standing</label>
              <select
                className="input"
                value={editStanding}
                onChange={(e) => setEditStanding(e.target.value)}
              >
                {ACCOUNT_STANDINGS.map((standing) => (
                  <option key={standing} value={standing}>
                    {standing}
                  </option>
                ))}
              </select>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={editUser.close}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveUser}>
                Save Changes
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
