import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerBookingsPage from '@/pages/owner/BookingsPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

/** The owner bookings endpoint returns rows already shaped for the table. */
function row(overrides = {}) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return {
    id: 4101,
    bookingDate: todayStr,
    time: '19:00',
    bookingCode: 'BK-4101',
    customer: 'Nabil Ahmed',
    sub: '+8801700000001',
    pitch: 'Pitch 1',
    source: { tone: 'blue', text: 'Online' },
    amountFormatted: '৳2,500',
    payment: { tone: 'amber', text: 'Pending' },
    actions: [
      { label: 'Approve', variant: 'primary', action: 'approve' },
      { label: 'Cancel', variant: 'ghostDanger', action: 'cancel' },
    ],
    ...overrides,
  };
}

function renderOwnerBookings(routes) {
  signIn({ id: 9, role: 'OWNER', fullName: 'Turf Owner' });
  const fetchMock = mockApi(routes);
  renderApp(<OwnerBookingsPage />, { route: '/owner/bookings' });
  return fetchMock;
}

/** Every write the page issued against the owner booking endpoints. */
function writes(fetchMock) {
  return fetchMock.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).includes('/owner/bookings/'))
    .map(([url]) => String(url));
}

const BASE_ROUTES = [
  ['/players/me', { body: {} }],
  ['/owner/venues', { body: [{ id: 3, name: 'Kick Off Arena', pitchCount: 2 }] }],
  ['/turf-requests', { body: [] }],
];

describe('Owner BookingsPage — row actions', () => {
  it('shows the rows the API returned, not a placeholder table', async () => {
    renderOwnerBookings([
      ...BASE_ROUTES,
      ['/owner/bookings', { body: [row()] }],
    ]);

    expect(await screen.findByText('BK-4101')).toBeInTheDocument();
    expect(screen.getByText('Nabil Ahmed')).toBeInTheDocument();
    expect(screen.getByText('৳2,500')).toBeInTheDocument();
  });

  it('approving calls the approve endpoint for that booking and confirms only after it succeeds', async () => {
    const fetchMock = renderOwnerBookings([
      ...BASE_ROUTES,
      ['/owner/bookings/4101/approve', { body: { status: 'CONFIRMED' } }],
      ['/owner/bookings', { body: [row()] }],
    ]);

    await screen.findByText('BK-4101');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(writes(fetchMock).some((u) => u.endsWith('/owner/bookings/4101/approve'))).toBe(true),
    );
    expect(await screen.findByText(/booking approved/i)).toBeInTheDocument();
  });

  it('refunding prompts confirmation and calls the refund endpoint only after confirming', async () => {
    const fetchMock = renderOwnerBookings([
      ...BASE_ROUTES,
      ['/owner/bookings/4101/refund', { body: { refundAmount: 2500 } }],
      [
        '/owner/bookings',
        {
          body: [
            row({
              payment: { tone: 'green', text: 'Paid' },
              actions: [{ label: 'Refund', variant: 'ghostDanger', action: 'refund' }],
            }),
          ],
        },
      ],
    ]);

    await screen.findByText('BK-4101');
    await userEvent.click(screen.getByRole('button', { name: 'Refund' }));

    // Confirmation modal is displayed
    expect(await screen.findByText(/confirm refund/i)).toBeInTheDocument();
    expect(screen.getByText(/yes, refund booking/i)).toBeInTheDocument();

    // Confirm the refund
    await userEvent.click(screen.getByRole('button', { name: 'Yes, refund booking' }));

    await waitFor(() =>
      expect(writes(fetchMock).some((u) => u.endsWith('/owner/bookings/4101/refund'))).toBe(true),
    );
    expect(writes(fetchMock).some((u) => u.includes('/cancel'))).toBe(false);
  });

  it('cancelling the refund modal leaves the booking untouched', async () => {
    const fetchMock = renderOwnerBookings([
      ...BASE_ROUTES,
      [
        '/owner/bookings',
        {
          body: [
            row({
              payment: { tone: 'green', text: 'Paid' },
              actions: [{ label: 'Refund', variant: 'ghostDanger', action: 'refund' }],
            }),
          ],
        },
      ],
    ]);

    await screen.findByText('BK-4101');
    await userEvent.click(screen.getByRole('button', { name: 'Refund' }));

    expect(await screen.findByText(/confirm refund/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

    expect(screen.queryByText(/confirm refund/i)).not.toBeInTheDocument();
    expect(writes(fetchMock).length).toBe(0);
  });

  it('filters manual sources as one honest group (Phone vs Walk-in was fabricated from booking-code parity)', async () => {
    renderOwnerBookings([
      ...BASE_ROUTES,
      [
        '/owner/bookings',
        {
          body: [
            row({ id: 101, bookingCode: 'MB-PHONE1', source: { tone: 'purple', text: 'Phone' } }),
            row({ id: 102, bookingCode: 'MB-WALK1', source: { tone: 'amber', text: 'Walk-in' } }),
            row({ id: 103, bookingCode: 'TC-ONLINE1', source: { tone: 'green', text: 'Online' } }),
          ],
        },
      ],
    ]);

    await screen.findByText('MB-PHONE1');
    const manualFilter = screen.getByRole('button', { name: /manual \/ phone \/ walk-in/i });
    await userEvent.click(manualFilter);

    expect(screen.getByText('MB-PHONE1')).toBeInTheDocument();
    expect(screen.getByText('MB-WALK1')).toBeInTheDocument();
    expect(screen.queryByText('TC-ONLINE1')).not.toBeInTheDocument();

    const onlineFilter = screen.getByRole('button', { name: 'Online' });
    await userEvent.click(onlineFilter);

    expect(screen.getByText('TC-ONLINE1')).toBeInTheDocument();
    expect(screen.queryByText('MB-PHONE1')).not.toBeInTheDocument();
    expect(screen.queryByText('MB-WALK1')).not.toBeInTheDocument();
  });

  it('reports the server\u2019s refusal instead of announcing a cancellation that never happened', async () => {
    renderOwnerBookings([
      ...BASE_ROUTES,
      [
        '/owner/bookings/4101/cancel',
        { status: 409, body: { message: 'This booking has already started' } },
      ],
      ['/owner/bookings', { body: [row()] }],
    ]);

    await screen.findByText('BK-4101');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Cancel now confirms first (destructive action, same pattern as refund).
    expect(await screen.findByText(/confirm cancellation/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }));

    expect(await screen.findByText(/already started/i)).toBeInTheDocument();
    expect(screen.queryByText(/slot released/i)).not.toBeInTheDocument();
  });

  it('a second click while a write is in flight does not fire a second write', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    signIn({ id: 9, role: 'OWNER' });
    const routes = [
      ...BASE_ROUTES,
      ['/owner/bookings', { body: [row()] }],
    ];
    let approveCalls = 0;
    globalThis.fetch.mockImplementation(async (input) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.includes('/owner/bookings/4101/approve')) {
        approveCalls += 1;
        await gate;
        return jsonResponse({ status: 'CONFIRMED' });
      }
      const match = routes.find(([fragment]) => url.includes(fragment));
      return jsonResponse(match ? match[1].body : null);
    });

    renderApp(<OwnerBookingsPage />, { route: '/owner/bookings' });

    await screen.findByText('BK-4101');
    const approve = screen.getByRole('button', { name: 'Approve' });
    await userEvent.click(approve);
    await userEvent.click(approve).catch(() => {});

    expect(approveCalls).toBe(1);
    release();
  });

  it('renders a friendly contextual empty state when filtering by Payment pending with no matching bookings', async () => {
    renderOwnerBookings([
      ...BASE_ROUTES,
      [
        '/owner/bookings',
        {
          body: [
            row({
              payment: { tone: 'green', text: 'Paid' },
            }),
          ],
        },
      ],
    ]);

    await screen.findByText('BK-4101');
    const paymentPendingFilter = screen.getByRole('button', { name: 'Payment pending' });
    await userEvent.click(paymentPendingFilter);

    expect(screen.getByText('No pending payments')).toBeInTheDocument();
    expect(screen.getByText(/all current bookings are settled or paid/i)).toBeInTheDocument();
    
    // Clicking "View all bookings" clears the filter and shows the bookings again
    const viewAllBtn = screen.getByRole('button', { name: 'View all bookings' });
    await userEvent.click(viewAllBtn);
    expect(screen.getByText('BK-4101')).toBeInTheDocument();
  });

  it('renders a friendly search empty state and allows clearing the query', async () => {
    renderOwnerBookings([
      ...BASE_ROUTES,
      ['/owner/bookings', { body: [row()] }],
    ]);

    await screen.findByText('BK-4101');
    const searchInput = screen.getByRole('textbox', { name: /search bookings/i });
    await userEvent.type(searchInput, 'NonExistentCustomer');

    expect(screen.getByText(/no bookings matching "nonexistentcustomer"/i)).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    await userEvent.click(clearBtn);

    expect(screen.getByText('BK-4101')).toBeInTheDocument();
  });
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
