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
