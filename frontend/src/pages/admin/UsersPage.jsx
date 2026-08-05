import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = ['All Accounts', 'Players', 'Turf Owners', 'Game Hosts', 'Suspended'];

const ROLE_CHIPS = ['Player', 'Turf Owner', 'Game Host'];

const ACCOUNT_STANDINGS = ['Active', 'Restricted (No Matchmaking)', 'Suspended'];

const USERS = [
  {
    id: '#40221',
    name: 'Rafiul Karim',
    initials: 'RK',
    avatarClass: 'avatar sm',
    avatarStyle: undefined,
    phone: '+880 1712 ••• 890',
    roles: [{ label: 'Player', tone: 'green' }],
    bookings: 12,
    reliability: '98%',
    reliabilityStyle: undefined,
    joined: 'Mar 2025',
    status: 'Active',
    statusTone: 'green',
    rowStyle: undefined,
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
    reliabilityStyle: undefined,
    joined: 'Jan 2024',
    status: 'Active',
    statusTone: 'green',
    rowStyle: undefined,
    flagged: false,
  },
  {
    id: '#33107',
    name: 'Rifat Hossain',
    initials: 'RH',
    avatarClass: 'avatar sm c',
    avatarStyle: undefined,
    phone: '+880 1616 ••• 771',
    roles: [
      { label: 'Player', tone: 'green' },
      { label: 'Game Host', tone: 'blue' },
    ],
    bookings: 68,
    reliability: '97%',
    reliabilityStyle: undefined,
    joined: 'Aug 2024',
    status: 'Active',
    statusTone: 'green',
    rowStyle: undefined,
    flagged: false,
  },
  {
    id: '#38112',
    name: 'M. Babul',
    initials: 'MB',
    avatarClass: 'avatar sm d',
    avatarStyle: undefined,
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

export default function UsersPage() {
  const { showToast } = useToast();
  const editUser = useDisclosure(false);
  const delUser = useDisclosure(false);
  const [filter, setFilter] = useState('All Accounts');
  const [search, setSearch] = useState('');
  const [editName, setEditName] = useState('Rafiul Karim');
  const [editPhone, setEditPhone] = useState('+880 1712 345 890');
  const [editStanding, setEditStanding] = useState('Active');
  const [editRoles, setEditRoles] = useState(['Player']);
  const [editNote, setEditNote] = useState('');

  const term = search.trim().toLowerCase();
  const rows = term
    ? USERS.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.phone.toLowerCase().includes(term) ||
          user.id.toLowerCase().includes(term),
      )
    : USERS;

  const toggleRole = (role) =>
    setEditRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );

  const saveUser = () => {
    editUser.close();
    showToast('User account updated & logged ✓');
  };

  const confirmDelete = () => {
    delUser.close();
    showToast('Account deleted — notification SMS sent');
  };
