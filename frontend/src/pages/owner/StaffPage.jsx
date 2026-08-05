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