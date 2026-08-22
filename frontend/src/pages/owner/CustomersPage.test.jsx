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
    note: 'Team captain',
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
    note: '',
  },
];

function renderCustomers(customers = CUSTOMERS) {
  signIn({ id: 9, role: 'OWNER' });
  mockApi([
    ['/players/me', { body: {} }],
    ['/owner/customers', { body: customers }],
    ['/owner/customers/11/note', { body: { success: true, note: 'Updated note' } }],
    ['/owner/customers/11/reward', { body: { success: true, message: '10% coupon emailed to Nabil Ahmed!' } }],
    ['/owner/customers/reward-regulars', { body: { success: true, message: '10% coupon emailed to 1 regular customer!' } }],
  ]);
  renderApp(<CustomersPage />, { route: '/owner/customers' });
}

describe('Owner CustomersPage — real customer data', () => {
  it('does not display an "+ Add customer" button', async () => {
    renderCustomers();
    expect(await screen.findByText('Nabil Ahmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add customer/i })).not.toBeInTheDocument();
  });

  it('shows the last visit the API sent instead of an empty cell', async () => {
    renderCustomers();

    expect(await screen.findByText('Nabil Ahmed')).toBeInTheDocument();
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

  it('shows Show note / Add note buttons and opens modal on click', async () => {
    renderCustomers();

    await screen.findByText('Nabil Ahmed');
    const showNoteBtn = screen.getByRole('button', { name: /📝 Show note/i });
    expect(showNoteBtn).toBeInTheDocument();

    const addNoteBtn = screen.getByRole('button', { name: /📝 Add note/i });
    expect(addNoteBtn).toBeInTheDocument();

    await userEvent.click(showNoteBtn);
    expect(screen.getByText('Note for Nabil Ahmed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Team captain')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save note/i });
    await userEvent.click(saveBtn);
  });

  it('renders rich EmptyState when no customers match filter or search', async () => {
    renderCustomers([]);
    expect(await screen.findByText('No customers found')).toBeInTheDocument();
  });

  it('shows reward button for all customers and opens reward modal', async () => {
    renderCustomers();
    await screen.findByText('Nabil Ahmed');

    const rewardButtons = screen.getAllByRole('button', { name: /🎁 Reward 10%/i });
    expect(rewardButtons.length).toBe(2);

    await userEvent.click(rewardButtons[0]);
    expect(screen.getByText('Reward Regular Customer')).toBeInTheDocument();
    expect(screen.getByText(/LOYAL10/)).toBeInTheDocument();
  });
});
