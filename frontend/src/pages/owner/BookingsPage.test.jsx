import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerBookingsPage from '@/pages/owner/BookingsPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

/** The owner bookings endpoint returns rows already shaped for the table. */
function row(overrides = {}) {
  return {
    id: 4101,
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

  it('refunding calls the refund endpoint, not cancel', async () => {
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

    await waitFor(() =>
      expect(writes(fetchMock).some((u) => u.endsWith('/owner/bookings/4101/refund'))).toBe(true),
    );
    expect(writes(fetchMock).some((u) => u.includes('/cancel'))).toBe(false);
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
