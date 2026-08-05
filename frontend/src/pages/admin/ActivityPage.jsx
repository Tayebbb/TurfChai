import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = [
  'All Activity',
  'Approvals',
  'Rejections',
  'User Suspensions',
  'System Alerts',
];

const DANGER_AVATAR = { background: 'var(--danger-soft)', color: 'var(--danger)' };

const AUDIT_ENTRIES = [
  {
    id: 'log-1',
    time: 'Today 6:24 PM',
    admin: 'Farid Hasan',
    avatarClass: 'avatar sm b',
    avatarStyle: undefined,
    action: 'Approved Request',
    actionTone: 'green',
    target: 'TR-1039',
    targetNum: true,
    details: 'GreenTurf Annex → Listing published as pending venue setup',
    rowStyle: undefined,
  },
  {
    id: 'log-2',
    time: 'Today 4:02 PM',
    admin: 'Nadia Amin',
    avatarClass: 'avatar sm',
    avatarStyle: DANGER_AVATAR,
    action: 'Suspended Player',
    actionTone: 'red',
    target: '#38112',
    targetNum: true,
    details: 'Reason: Repeated no-shows & abusive chat reports',
    rowStyle: undefined,
  },
  {
    id: 'log-3',
    time: 'Today 1:15 PM',
    admin: 'Farid Hasan',
    avatarClass: 'avatar sm b',
    avatarStyle: undefined,
    action: 'Rejected Request',
    actionTone: 'red',
    target: 'TR-1037',
    targetNum: true,
    details: 'Reason: Trade license expired March 2026',
    rowStyle: undefined,
  },
  {
    id: 'log-4',
    time: 'Today 11:41 AM',
    admin: 'Tania Sultana',
    avatarClass: 'avatar sm c',
    avatarStyle: undefined,
    action: 'Approved Refund',
    actionTone: 'blue',
    target: 'TC-48102',
    targetNum: true,
    details: '৳2,200 refund issued (Free cancellation > 24h prior)',
    rowStyle: undefined,
  },
  {
    id: 'log-5',
    time: 'Today 11:30 AM',
    admin: '⚙️ System Automation',
    avatarClass: undefined,
    avatarStyle: undefined,
    initials: undefined,
    action: 'Risk Flag Raised',
    actionTone: 'amber',
    target: 'V-0077',
    targetNum: true,
    details: 'Payout Anomaly: Refund ratio 4× baseline · Venue auto-suspended',
    rowStyle: { background: 'rgba(251,191,36,0.06)' },
  },
  {
    id: 'log-6',
    time: 'Today 9:02 AM',
    admin: 'Nadia Amin',
    avatarClass: 'avatar sm',
    avatarStyle: DANGER_AVATAR,
    action: 'Signed In',
    actionTone: 'gray',
    target: '—',
    targetNum: false,
    details: '2FA Passed · Chrome (Windows) · IP 103.205.x.x',
    rowStyle: undefined,
  },
];

/** Derives avatar initials from the administrator name (e.g. "Farid Hasan" → "FH"). */
function initialsOf(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function ActivityPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All Activity');
  const [search, setSearch] = useState('');

  const term = search.trim().toLowerCase();
  const rows = term
    ? AUDIT_ENTRIES.filter(
        (entry) =>
          entry.action.toLowerCase().includes(term) ||
          entry.admin.toLowerCase().includes(term) ||
          entry.target.toLowerCase().includes(term),
      )
    : AUDIT_ENTRIES;
