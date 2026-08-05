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
