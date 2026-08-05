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

  return (
    <>
      <PageTitle title="Bookings" />

      <div className="main-header">
        <div>
          <h1>Bookings</h1>
          <span className="subtle small">All sources · searchable &amp; filterable</span>
        </div>
        <Button variant="primary" onClick={() => showToast('Manual booking drawer — see Calendar page')}>
          + Manual booking
        </Button>
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <Input
          style={{ maxWidth: 260 }}
          placeholder="🔍 Search name, phone, ref…"
          aria-label="Search bookings"
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
              <th>Time</th>
              <th>Ref</th>
              <th>Customer</th>
              <th>Pitch</th>
              <th>Source</th>
              <th className="num">Amount</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} style={row.dim ? { opacity: 0.65 } : undefined}>
                <td className="num">{row.time}</td>
                <td className="num">{row.id}</td>
                <td>
                  {row.customer}
                  <br />
                  <span className={row.subNum ? 'tiny subtle num' : 'tiny subtle'}>{row.sub}</span>
                </td>
                <td>{row.pitch}</td>
                <td>
                  <Badge tone={row.source.tone} dot={false}>
                    {row.source.text}
                  </Badge>
                </td>
                <td className="num">{row.amount}</td>
                <td>
                  <Badge tone={row.payment.tone}>{row.payment.text}</Badge>
                </td>
                <td>
                  {row.actions.length > 1 ? (
                    <div className="row" style={{ gap: 6 }}>
                      {row.actions.map((action) => (
                        <Button
                          key={action.label}
                          size="sm"
                          variant={action.variant}
                          onClick={() => showToast(action.toast)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={row.actions[0].variant}
                      onClick={() => showToast(row.actions[0].toast)}
                    >
                      {row.actions[0].label}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="between small" style={{ marginTop: 10 }}>
        <span className="subtle">Showing {visible.length} of 14 bookings today</span>
        <div className="row">
          <Button size="sm" variant="tertiary" onClick={() => showToast('Previous page')}>
            ‹ Prev
          </Button>
          <Button size="sm" variant="tertiary" onClick={() => showToast('Next page')}>
            Next ›
          </Button>
        </div>
      </div>
    </>
  );
}