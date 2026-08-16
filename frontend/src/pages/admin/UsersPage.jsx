import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { downloadCsv } from '@/utils/deviceActions';
import { paths } from '@/routes/paths';
import { listAdminUsers, updateUserStatus, reinstateUser } from '@/api/adminUsers';
import { useApi } from '@/hooks/useApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const FILTERS = ['All Accounts', 'Players', 'Turf Owners', 'Game Hosts', 'Suspended'];

const ROLE_CHIPS = ['Player', 'Turf Owner', 'Game Host'];

const ACCOUNT_STANDINGS = ['Active', 'Restricted (No Matchmaking)', 'Suspended'];

const PAGE_SIZE = 25;


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

  // The roster used to arrive whole — 842 accounts, 421 KB, ~17k DOM nodes —
  // and refetch on every keystroke.
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: res, loading, error, reload } = useApi(
    () => listAdminUsers(roleParam, statusParam, debouncedSearch, page, PAGE_SIZE),
    [filter, debouncedSearch, page],
  );

  const pageData = res?.data ?? res;
  const totalUsers = pageData?.total ?? 0;
  const totalPages = pageData?.totalPages ?? 0;

  const userRows = useMemo(() => {
    const apiUsersData = pageData?.items ?? [];
    if (!Array.isArray(apiUsersData)) return [];
    return apiUsersData.map((u) => {
      const isSuspended = Boolean(u.isSuspended) || u.status === 'SUSPENDED';
      return {
        dbId: u.id,
        id: `#${u.id}`,
        name: u.fullName ?? '—',
        initials: initialsOf(u.fullName),
        avatarClass: 'avatar sm',
        phone: u.phone || '—',
        roles: [{ label: u.role || 'Player', tone: u.role === 'HOST' ? 'blue' : 'green' }],
        bookings: u.gamesAttended || 0,
        reliability: `${u.reliabilityScore ?? 100}%`,
        joined: u.createdAt
          ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : '—',
        status: isSuspended ? 'Suspended' : u.status || 'Active',
        statusTone: isSuspended ? 'red' : 'green',
        rowStyle: isSuspended ? { background: 'rgba(201,59,59,0.08)' } : undefined,
        flagged: isSuspended,
      };
    });
  }, [pageData]);

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditStanding(user.status);
    editUser.open();
  };

  const saveUser = async () => {
    if (!selectedUser?.dbId) return;
    try {
      const isSusp = editStanding === 'Suspended';
      await updateUserStatus(selectedUser.dbId, {
        status: editStanding.toUpperCase(),
        isSuspended: isSusp,
      });
      reload();
    } catch (e) {
      // Announcing "updated ✓" after a rejected write left the admin believing
      // an account had been suspended when nothing had changed.
      showToast(toUserMessage(e, 'Could not update this account.'));
      return;
    }
    editUser.close();
    showToast('User account updated ✓');
  };

  const handleReinstate = async (user) => {
    if (!user.dbId) return;
    try {
      await reinstateUser(user.dbId);
      reload();
    } catch (e) {
      showToast(toUserMessage(e, 'Could not lift this suspension.'));
      return;
    }
    showToast('Suspension lifted — logged to the audit trail');
  };

  const handleSuspendQuick = async (user) => {
    // This used to swallow the failure - and skip the call entirely when dbId
    // was missing - while still reporting success, so an admin believed an
    // abusive account was locked out when it was still fully active.
    if (!user.dbId) {
      showToast('This account cannot be suspended: it has no server record.');
      return;
    }
    try {
      await updateUserStatus(user.dbId, { status: 'SUSPENDED', isSuspended: true });
      reload();
    } catch (e) {
      showToast(toUserMessage(e, 'Could not suspend this account.'));
      return;
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
          disabled={userRows.length === 0}
          title={userRows.length === 0 ? 'Nothing to export for this filter' : undefined}
          onClick={() => {
            downloadCsv(
              `user-roster-page-${page + 1}.csv`,
              ['Id', 'Name', 'Phone', 'Role', 'Bookings', 'Reliability', 'Joined', 'Status'],
              userRows.map((user) => [
                user.id,
                user.name,
                user.phone,
                user.roles?.[0]?.label ?? '',
                user.bookings,
                user.reliability,
                user.joined,
                user.status,
              ]),
            );
            showToast(`Exported ${userRows.length} user${userRows.length === 1 ? '' : 's'} from this page ✓`);
          }}
        >
          ⬇ Export this page
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
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
        />
        {FILTERS.map((item) => (
          <Chip key={item} active={filter === item} onToggle={() => { setFilter(item); setPage(0); }}>
            {item}
          </Chip>
        ))}
      </div>

      {/* Users Table */}
      <TableScroll label="User accounts" className="liquid-glass" style={{ padding: 0, borderRadius: 16 }}>
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
                <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading users…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                  {toUserMessage(error, 'Could not load users.')}{' '}
                  <button type="button" className="btn btn-sm btn-tertiary" onClick={reload}>
                    Try again
                  </button>
                </td>
              </tr>
            ) : userRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="subtle" style={{ textAlign: 'center', padding: 24 }}>
                  No users match this filter.
                </td>
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
                          disabled
                          title="Flag reasons are not recorded against accounts yet."
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
      </TableScroll>

      <div className="between small" style={{ marginTop: 14 }}>
        <span className="subtle" role="status" aria-live="polite">
          {loading
            ? 'Loading users…'
            : `Showing ${userRows.length} of ${totalUsers} account${totalUsers === 1 ? '' : 's'}`}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="btn btn-sm btn-tertiary"
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹ Previous
          </button>
          <button
            className="btn btn-sm btn-tertiary"
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser.isOpen && (
        <Overlay
          isOpen
          title={`Edit User Profile · ${selectedUser?.id}`}
          onClose={editUser.close}
        >
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
