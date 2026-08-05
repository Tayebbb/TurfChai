import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = ['All', 'Regulars (4+ visits)', 'Venue loyalty members', 'Has no-shows'];

const CUSTOMERS = [
  {
    id: 'rafiul',
    initials: 'RK',
    name: 'Rafiul Karim',
    phone: '+880 1712 ••• 890',
    bookings: '12',
    spend: '৳29,400',
    lastVisit: 'Tonight 7:30 PM',
    loyalty: { tone: 'green', text: 'Regular · every 10th slot −20%' },
    noShows: '0',
    note: 'Note: prefers Pitch 2, brings own bibs',
  },
  {
    id: 'tanvir',
    initials: 'TA',
    tone: 'b',
    name: 'Tanvir Ahmed',
    phone: '+880 1615 ••• 234',
    bookings: '8',
    spend: '৳18,200',
    lastVisit: 'Today 4:00 PM',
    loyalty: { tone: 'green', text: 'Member' },
    noShows: '0',
    note: 'No notes yet — click to add',
  },
  {
    id: 'karim-traders',
    initials: 'KT',
    tone: 'c',
    name: 'Karim Traders XI',
    suffix: '(team)',
    phone: '+880 1911 ••• 456',
    bookings: '15',
    spend: '৳36,750',
    lastVisit: 'Tonight 7:30 PM',
    loyalty: { tone: 'green', text: 'Regular' },
    noShows: '1',
    note: 'Note: corporate team, monthly invoice requested',
  },
  {
    id: 'hasan',
    initials: 'HU',
    tone: 'd',
    name: 'Hasan Uddin',
    phone: '+880 1912 ••• 677',
    bookings: '3',
    spend: '৳4,850',
    lastVisit: 'Tonight 9:00 PM',
    loyalty: { tone: 'gray', text: 'Not enrolled' },
    noShows: '0',
    note: 'Note: phone-booking regular, pays cash',
  },
  {
    id: 'sadia',
    initials: 'SR',
    name: 'Sadia Rahman',
    phone: '+880 1710 ••• 118',
    bookings: '5',
    spend: '৳10,600',
    lastVisit: '25 Jul',
    loyalty: { tone: 'gray', text: 'Not enrolled' },
    noShows: '0',
    note: "Note: books women's league slots Sundays",
  },
  {
    id: 'mokbul',
    initials: 'MJ',
    tone: 'b',
    name: 'Mokbul Jamil',
    phone: '+880 1818 ••• 902',
    bookings: '4',
    spend: '৳7,300',
    lastVisit: '18 Jul',
    loyalty: { tone: 'gray', text: 'Not enrolled' },
    noShows: '2',
    noShowsDanger: true,
    note: 'Note: require full prepayment — repeated no-shows',
  },
];

export default function CustomersPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['All']);
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term
    ? CUSTOMERS.filter((row) => `${row.name} ${row.phone}`.toLowerCase().includes(term))
    : CUSTOMERS;