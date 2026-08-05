import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Checkline } from '@/components/forms/Toggles';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { initials as toInitials } from '@/utils/format';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';

const INITIAL_TEAM = [
  {
    id: 'mahmud',
    name: 'Mahmudul Hasan',
    initials: 'MH',
    avatarStyle: { background: 'var(--info-soft)', color: 'var(--info)' },
    role: 'Owner',
    badge: 'blue',
    detail: 'Full access · payouts · staff management',
    permissions: false,
  },
  {
    id: 'sumon',
    name: 'Sumon Barua',
    initials: 'SB',
    tone: 'b',
    role: 'Manager',
    badge: 'green',
    detail: 'Bookings · calendar · cash logging · promotions',
    permissions: true,
  },
  {
    id: 'jahid',
    name: 'Jahid Rana',
    initials: 'JR',
    tone: 'c',
    role: 'Front desk',
    badge: 'gray',
    detail: 'Check-ins · walk-in bookings · cash logging only',
    permissions: true,
  },
];

const ROLE_PRESETS = {
  'Co-owner': { badge: 'blue', detail: 'Full access · payouts · staff management' },
  Manager: { badge: 'green', detail: 'Bookings · calendar · cash logging' },
  'Front desk': { badge: 'gray', detail: 'Check-ins · walk-in bookings · cash logging only' },
  Accountant: { badge: 'amber', detail: 'View ledger, payouts & financial reports' },
};

const AUDIT_LOG = [
  { id: 'open', title: 'Sumon opened evening shift', detail: '7:01 PM · opening cash float ৳2,000 counted' },
  { id: 'cash', title: 'Jahid logged walk-in cash ৳1,700', detail: '3:05 PM · TC-48288 · Pitch 3' },
  { id: 'phone', title: 'Sumon added phone booking TC-48293', detail: '1:22 PM · deposit ৳510 via Nagad' },
  { id: 'refund', title: 'Owner approved refund ৳2,200', detail: '11:41 AM · TC-48102 · policy: free cancel 24h+' },
  { id: 'close', title: 'Sumon closed afternoon shift', detail: '7:00 PM · drawer balanced ✓ · handover note left' },
];

const PERMISSIONS = [
  { id: 'bookings', label: 'Manage bookings & calendar', on: true },
  { id: 'cash', label: 'Log cash payments', on: true },
  { id: 'shifts', label: 'Open / close shifts', on: true },
  { id: 'promos', label: 'Create promotions', on: true },
  { id: 'refunds', label: 'Issue refunds', on: false },
  { id: 'pricing', label: 'Edit pricing', on: false },
  { id: 'payouts', label: 'View payouts & settlement', on: false },
];

export default function StaffPage() {
  const { showToast } = useToast();
  const permDrawer = useDisclosure(false);
  const closeShift = useDisclosure(false);
  const inviteModal = useDisclosure(false);

  const [team, setTeam] = useState(INITIAL_TEAM);
  const [permissions, setPermissions] = useState(() =>
    Object.fromEntries(PERMISSIONS.map((item) => [item.id, item.on])),
  );
  const [handoverNote, setHandoverNote] = useState('');
  const [counted, setCounted] = useState('৳3,785');
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Front desk' });

  function sendInvite() {
    const name = invite.name.trim() || 'Invited Member';
    const email = invite.email.trim() || 'member@example.com';
    const preset = ROLE_PRESETS[invite.role];

    setTeam((current) => [
      ...current,
      {
        id: `invite-${Date.now()}`,
        name,
        initials: toInitials(name) || 'TM',
        avatarStyle: { background: 'var(--brand-soft)', color: 'var(--brand)' },
        role: invite.role,
        badge: preset.badge,
        detail: `${preset.detail} · ${email}`,
        pending: true,
        permissions: true,
      },
    ]);

    showToast(`Invitation link sent to ${email} (${invite.role}) via Email 📧`);
    inviteModal.close();
    setInvite((current) => ({ ...current, name: '', email: '' }));
  }

  return (
    <>
      <PageTitle title="Staff & Shifts" />

      <div className="main-header">
        <div>
          <h1>Staff &amp; Shifts</h1>
          <span className="subtle small">Who can do what — and where every taka went</span>
        </div>
        <Button variant="primary" onClick={inviteModal.open}>
          + Invite staff / owner
        </Button>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="card">
            <h3>Team</h3>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {team.map((member) => (
                <div className="panel between" key={member.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar initials={member.initials} tone={member.tone} style={member.avatarStyle} />
                    <div>
                      <b className="small">{member.name}</b>{' '}
                      <Badge tone={member.badge} dot={false}>
                        {member.role}
                      </Badge>
                      {member.pending ? (
                        <>
                          {' '}
                          <Badge tone="amber" dot={false}>
                            Invite sent
                          </Badge>
                        </>
                      ) : null}
                      <div className="tiny subtle">{member.detail}</div>
                    </div>
                  </div>
                  {member.permissions ? (
                    <Button size="sm" onClick={permDrawer.open}>
                      Permissions
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Today&apos;s shifts</h3>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              <div className="panel between">
                <div>
                  <b className="small num">6:00 AM – 2:00 PM · Morning</b>{' '}
                  <Badge tone="gray" dot={false}>
                    Closed
                  </Badge>
                  <div className="tiny subtle">Jahid R. · cash ৳0 · balanced ✓</div>
                </div>
              </div>
              <div className="panel between">
                <div>
                  <b className="small num">2:00 PM – 7:00 PM · Afternoon</b>{' '}
                  <Badge tone="gray" dot={false}>
                    Closed
                  </Badge>
                  <div className="tiny subtle">
                    Sumon B. · cash expected ৳1,700 · counted ৳1,700 · balanced ✓
                  </div>
                </div>
                <Button size="sm" variant="tertiary" onClick={() => showToast('Shift report opened 🧾')}>
                  Report
                </Button>
              </div>
              <div className="panel between" style={{ borderLeft: '3px solid var(--brand)' }}>
                <div>
                  <b className="small num">7:00 PM – 11:30 PM · Evening</b>{' '}
                  <Badge tone="green">Open · Sumon B.</Badge>
                  <div className="tiny subtle">Cash so far ৳0 · ৳4,300 deposits due for collection</div>
                </div>
                <Button size="sm" variant="primary" onClick={closeShift.open}>
                  Close shift
                </Button>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="hnote">Handover note for next shift</label>
              <Input
                id="hnote"
                placeholder="e.g. Pitch 3 floodlight flickering — electrician coming 9 AM"
                value={handoverNote}
                onChange={(event) => setHandoverNote(event.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => showToast('Handover note saved 📝')}>
              Save note
            </Button>
          </section>
        </div>

        <section className="card">
          <h3>Audit log</h3>
          <p className="subtle small" style={{ margin: '2px 0 10px' }}>
            Every staff action is recorded — nothing disappears.
          </p>
          <ul className="tline">
            {AUDIT_LOG.map((entry) => (
              <li key={entry.id}>
                <b className="small">{entry.title}</b>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {entry.detail}
                </p>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="tertiary"
            style={{ marginTop: 8 }}
            onClick={() => showToast('Full audit history opened')}
          >
            View full history
          </Button>
        </section>
      </div>

      {/* Permissions drawer */}
      <Overlay
        isOpen={permDrawer.isOpen}
        onClose={permDrawer.close}
        title="Permissions · Sumon Barua"
        mode="drawer"
      >
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {PERMISSIONS.map((item) => (
            <Checkline
              key={item.id}
              label={item.label}
              checked={permissions[item.id]}
              onChange={(event) =>
                setPermissions((current) => ({ ...current, [item.id]: event.target.checked }))
              }
            />
          ))}
        </div>
        <Button
          variant="primary"
          block
          style={{ marginTop: 14 }}
          onClick={() => {
            permDrawer.close();
            showToast('Permissions updated ✓');
          }}
        >
          Save permissions
        </Button>
      </Overlay>

      {/* Close shift modal */}
      <Overlay isOpen={closeShift.isOpen} onClose={closeShift.close} title="Close evening shift" hideHeader>
        <h3>Close evening shift</h3>
        <p className="subtle small">Count the drawer — the ledger says what to expect.</p>
        <div className="pricerow" style={{ marginTop: 8 }}>
          <span>Opening float</span>
          <span className="num">৳2,000</span>
        </div>
        <div className="pricerow">
          <span>Cash logged this shift</span>
          <span className="num">৳1,785</span>
        </div>
        <div className="pricerow total">
          <span>Expected in drawer</span>
          <span className="num">৳3,785</span>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="counted">Counted amount</label>
          <Input
            className="num"
            id="counted"
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
          />
        </div>
        <Alert tone="ok" icon="✓" title="Balanced" style={{ margin: '0 0 12px' }}>
          Counted matches expected — no discrepancy.
        </Alert>
        <Button
          variant="primary"
          block
          onClick={() => {
            closeShift.close();
            showToast('Shift closed & locked — report sent to owner 🧾');
          }}
        >
          Close &amp; lock shift
        </Button>
        <Button variant="tertiary" block onClick={closeShift.close}>
          Cancel
        </Button>
      </Overlay>

      {/* Modal: Invite Staff / Owner */}
      <Overlay
        isOpen={inviteModal.isOpen}
        onClose={inviteModal.close}
        title="Invite team member or co-owner"
        maxWidth={480}
      >
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          An invitation link with setup credentials will be sent to the email address below.
        </p>

        <Field label="Full Name" htmlFor="stName">
          <Input
            id="stName"
            placeholder="e.g. Tariqul Islam"
            value={invite.name}
            onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label="Email Address" htmlFor="stEmail">
          <Input
            id="stEmail"
            type="email"
            placeholder="e.g. tariqul@example.com"
            value={invite.email}
            onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>

        <Field label="Role & Access Level" htmlFor="stRole">
          <Select
            id="stRole"
            value={invite.role}
            onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}
          >
            <option value="Co-owner">Co-owner · Full access, payouts &amp; staff management</option>
            <option value="Manager">Manager · Calendar, bookings, cash &amp; promotions</option>
            <option value="Front desk">Front desk / Staff · Check-ins, walk-ins, cash logging only</option>
            <option value="Accountant">Accountant · View ledger, settlements &amp; financial reports</option>
          </Select>
        </Field>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="primary" block onClick={sendInvite}>
            Send Email Invitation Link 📧
          </Button>
          <Button variant="tertiary" block onClick={inviteModal.close}>
            Cancel
          </Button>
        </div>
      </Overlay>
    </>
  );
}