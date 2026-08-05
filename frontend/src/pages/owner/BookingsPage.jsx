import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';

const FILTERS = [
  'Today',
  'This week',
  'Pitch 2',
  'Online',
  'Phone',
  'Walk-in',
  'Payment pending',
];

const BOOKINGS = [
  {
    id: 'TC-48277',
    time: '4:00 PM',
    customer: 'Tanvir Ahmed',
    sub: '+880 1615 ••• 234',
    subNum: true,
    pitch: 'Pitch 1',
    source: { tone: 'green', text: 'Online' },
    amount: '৳2,500',
    payment: { tone: 'green', text: 'Paid' },
    actions: [
      { label: 'Check in', variant: 'secondary', toast: 'Checked in ✓' },
      { label: '⋯', variant: 'tertiary', toast: 'Detail drawer — see Calendar page' },
    ],
  },
  {
    id: 'TC-48291',
    time: '7:30 PM',
    customer: 'Rafiul Karim',
    sub: '+880 1712 ••• 890',
    subNum: true,
    pitch: 'Pitch 2',
    source: { tone: 'green', text: 'Online' },
    amount: '৳2,550',
    payment: { tone: 'green', text: 'Paid · split 10/10' },
    actions: [
      { label: 'Check in', variant: 'secondary', toast: 'Checked in ✓' },
      { label: '⋯', variant: 'tertiary', toast: 'Detail drawer — see Calendar page' },
    ],
  },
  {
    id: 'TC-48285',
    time: '7:30 PM',
    customer: 'Karim Traders XI',
    sub: '+880 1911 ••• 456',
    subNum: true,
    pitch: 'Pitch 1',
    source: { tone: 'amber', text: 'Phone' },
    amount: '৳2,550',
    payment: { tone: 'amber', text: '৳1,785 due at venue' },
    actions: [
      { label: 'Collect', variant: 'primary', toast: '৳1,785 cash collected — logged to evening shift ✓' },
      { label: '⋯', variant: 'tertiary', toast: 'Detail drawer' },
    ],
  },
  {
    id: 'OG-7734',
    time: '9:00 PM',
    customer: 'Open game · Rifat H.',
    sub: '10 players · all paid',
    pitch: 'Pitch 2',
    source: { tone: 'blue', text: 'Open game' },
    amount: '৳2,800',
    payment: { tone: 'green', text: 'Paid' },
    actions: [{ label: '⋯', variant: 'tertiary', toast: 'Detail drawer' }],
  },
  {
    id: 'TC-48293',
    time: '9:00 PM',
    customer: 'Hasan Uddin',
    sub: '+880 1912 ••• 677',
    subNum: true,
    pitch: 'Pitch 3',
    source: { tone: 'amber', text: 'Phone' },
    amount: '৳1,700',
    payment: { tone: 'amber', text: 'Deposit ৳510' },
    actions: [
      { label: 'Remind', variant: 'secondary', toast: 'Reminder SMS sent 📩' },
      { label: '⋯', variant: 'tertiary', toast: 'Detail drawer' },
    ],
  },
  {
    id: 'TC-48102',
    time: '11:00 AM',
    customer: 'Sadia Rahman',
    sub: '+880 1710 ••• 118',
    subNum: true,
    pitch: 'Pitch 2',
    source: { tone: 'green', text: 'Online' },
    amount: '৳2,200',
    payment: { tone: 'red', text: 'Cancelled · refunded' },
    dim: true,
    actions: [
      { label: '⋯', variant: 'tertiary', toast: 'Refund detail — ৳2,200 to bKash, TXN R-2210' },
    ],
  },
];

export default function BookingsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['Today']);
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term
    ? BOOKINGS.filter((row) =>
        `${row.customer} ${row.sub} ${row.id}`.toLowerCase().includes(term),
      )
    : BOOKINGS;