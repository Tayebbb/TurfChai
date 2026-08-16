import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersPage from '@/pages/owner/CustomersPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const CUSTOMERS = [
  {
    id: '11',
    name: 'Nabil Ahmed',
    phone: '+8801700000001',
    initials: 'N',
    tone: 'green',
    bookings: 12,
    confirmedVisits: 11,
    spend: '৳26,400',
    lastVisit: '2026-08-14',
    loyalty: { tone: 'green', text: 'VIP · 11 visits' },
    noShows: 0,
    noShowsDanger: false,
  },
  {
    id: '12',
    name: 'Sadia Rahman',
    phone: '+8801700000002',
    initials: 'S',
    tone: 'green',
    bookings: 2,
    confirmedVisits: 2,
    spend: '৳4,000',
    lastVisit: '2026-07-02',
    loyalty: { tone: 'gray', text: '2 visits' },
    noShows: 4,
    noShowsDanger: true,
  },
];

function renderCustomers() {
  signIn({ id: 9, role: 'OWNER' });
  mockApi([
    ['/players/me', { body: {} }],
    ['/owner/customers', { body: CUSTOMERS }],
  ]);
  renderApp(<CustomersPage />, { route: '/owner/customers' });
}

describe('Owner CustomersPage — real customer data', () => {
  it('shows the last visit the API sent instead of an empty cell', async () => {
    renderCustomers();

    expect(await screen.findByText('Nabil Ahmed')).toBeInTheDocument();
    // The page read `row.lastVisit` while the API sent `last`, so this column
    // was blank for every customer.
    expect(screen.getByText('2026-08-14')).toBeInTheDocument();
    expect(screen.getByText('2026-07-02')).toBeInTheDocument();
  });

  it('shows real no-show counts rather than a placeholder dash', async () => {
    renderCustomers();

    await screen.findByText('Nabil Ahmed');
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('VIP · 11 visits')).toBeInTheDocument();
  });

  it('the filter chips actually narrow the list', async () => {
    renderCustomers();

    await screen.findByText('Nabil Ahmed');
    expect(screen.getByText('Sadia Rahman')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /has no-shows/i }));

    expect(screen.getByText('Sadia Rahman')).toBeInTheDocument();
    expect(screen.queryByText('Nabil Ahmed')).not.toBeInTheDocument();
  });

  it('the VIP filter keeps only customers who really reached the threshold', async () => {
    renderCustomers();

    await screen.findByText('Nabil Ahmed');
    await userEvent.click(screen.getByRole('button', { name: /VIPs \(10\+ visits\)/i }));

    expect(screen.getByText('Nabil Ahmed')).toBeInTheDocument();
    expect(screen.queryByText('Sadia Rahman')).not.toBeInTheDocument();
  });
});
