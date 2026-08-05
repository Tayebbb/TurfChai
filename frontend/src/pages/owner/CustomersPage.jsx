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

  return (
    <>
      <PageTitle title="Customers" />

      <div className="main-header">
        <div>
          <h1>Customers</h1>
          <span className="subtle small">Every player and team who has booked with you</span>
        </div>
        <Button variant="primary" onClick={() => showToast('Add customer form opened')}>
          + Add customer
        </Button>
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <Input
          style={{ maxWidth: 260 }}
          placeholder="🔍 Search name or phone…"
          aria-label="Search customers"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {FILTERS.map((filter) => (
          <Chip key={filter} active={chips.isActive(filter)} onToggle={() => chips.toggle(filter)}>
            {filter}
          </Chip>
        ))}
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th className="num">Bookings</th>
              <th className="num">Total spend</th>
              <th>Last visit</th>
              <th>Venue loyalty</th>
              <th className="num">No-shows</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar size="sm" initials={row.initials} tone={row.tone} />
                    <b>{row.name}</b>
                    {row.suffix ? <span className="tiny subtle">{row.suffix}</span> : null}
                  </div>
                </td>
                <td className="num small">{row.phone}</td>
                <td className="num">{row.bookings}</td>
                <td className="num">{row.spend}</td>
                <td>{row.lastVisit}</td>
                <td>
                  <Badge tone={row.loyalty.tone} dot={false}>
                    {row.loyalty.text}
                  </Badge>
                </td>
                <td className="num" style={row.noShowsDanger ? { color: 'var(--danger)' } : undefined}>
                  {row.noShows}
                </td>
                <td>
                  <Button size="sm" variant="tertiary" onClick={() => showToast(row.note)}>
                    📝
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Alert tone="info" icon="🎁" title="Reward your regulars" style={{ marginTop: 14 }}>
        Karim Traders XI hits 15 bookings — send a venue-loyalty offer from{' '}
        <Link to={paths.owner.promotions}>Promotions</Link>.
      </Alert>
    </>
  );
}