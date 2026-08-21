import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/pages/owner/DashboardPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const EMPTY_OWNER_API = [
  ['/players/me', { body: { fullName: 'Jashim Uddin', phone: '+8801700000000' } }],
  ['/owner/venues', { body: [] }],
  ['/turf-requests', { body: [] }],
  ['/owner/analytics', { body: { kpis: [] } }],
];

/**
 * TC-018: the greeting read `owner?.name`, which the API never returns (the
 * field is `fullName`), so every owner was greeted as "Owner" — and always
 * "Good evening" regardless of the clock.
 */
describe('Owner DashboardPage greeting (TC-018)', () => {
  it("uses the owner's real name from the profile", async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    mockApi(EMPTY_OWNER_API);

    renderApp(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: /Jashim Uddin/ })).toBeInTheDocument();
  });

  it('greets by the actual time of day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    mockApi(EMPTY_OWNER_API);

    renderApp(<DashboardPage />);

    // Timers are faked, so drive the pending promises manually.
    await vi.waitFor(() => {
      expect(screen.getByRole('heading', { name: /Good morning/ })).toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('falls back to a neutral greeting rather than inventing a name', async () => {
    signIn({ role: 'OWNER', fullName: undefined });
    mockApi([
      ['/players/me', { body: {} }],
      ['/owner/venues', { body: [] }],
      ['/turf-requests', { body: [] }],
      ['/owner/analytics', { body: { kpis: [] } }],
    ]);

    renderApp(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /there/ })).toBeInTheDocument();
    });
  });
});

const LIVE_OWNER_API = [
  ['/players/me', { body: { fullName: 'Jashim Uddin' } }],
  ['/owner/venues', { body: [{ id: 3, name: 'Kick Off Arena', status: 'LIVE' }] }],
  ['/turf-requests', { body: [] }],
  ['/owner/bookings', { body: [{ id: 1096, bookingCode: 'BK-4242', customer: 'Parveen Islam', pitch: 'Pitch B', time: '6:00 PM' }] }],
  ['/matchday/checkin', { body: null }],
  [
    '/owner/analytics',
    {
      body: {
        kpis: [{ label: 'Occupancy', value: '40%', delta: '2 of 5 slots today' }],
        activity: [],
        attention: [],
        weekly: {
          revenue: 8400, previousRevenue: 7000, occupancyPercent: 40,
          slotsBooked: 2, slotsPublished: 5, onlineBookings: 3, manualBookings: 1,
        },
      },
    },
  ],
];

/**
 * The dashboard's "Weekly performance" card was four hardcoded literals and the
 * QR panel was a pair of "Simulate scan" buttons that toasted success without
 * contacting the server.
 */
describe('Owner DashboardPage — real figures and a real check-in', () => {
  it('reports the week from the API instead of a fixed revenue goal', async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    mockApi(LIVE_OWNER_API);

    renderApp(<DashboardPage />);

    expect(await screen.findByText('৳8,400')).toBeInTheDocument();
    expect(screen.getByText('+20% vs the previous 7 days')).toBeInTheDocument();
    expect(screen.getByText('2 of 5 slots booked')).toBeInTheDocument();
    expect(screen.getByText('Online 75%')).toBeInTheDocument();
    expect(screen.getByText('Manual 25%')).toBeInTheDocument();
    // The literals that used to sit here on every venue.
    expect(screen.queryByText(/৳96,700/)).not.toBeInTheDocument();
    expect(screen.queryByText('68%')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone 22%')).not.toBeInTheDocument();
  });

  it('shows the occupancy detail the API computed it from', async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    mockApi(LIVE_OWNER_API);

    renderApp(<DashboardPage />);

    expect(await screen.findByText('2 of 5 slots today')).toBeInTheDocument();
  });

  it('check-in posts to the server for a booking that exists', async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    const fetchMock = mockApi(LIVE_OWNER_API);

    renderApp(<DashboardPage />);

    await screen.findByText('৳8,400');
    await userEvent.click(screen.getByRole('button', { name: /Scan player QR/i }));
    await userEvent.type(await screen.findByLabelText(/booking reference/i), 'BK-4242');
    await userEvent.click(screen.getByRole('button', { name: /^Check in$/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(
        ([url, init]) => init?.method === 'POST' && String(url).includes('/matchday/checkin'),
      );
      expect(calls.length).toBe(1);
      expect(String(calls[0][0])).toContain('bookingId=1096');
    });
    expect(await screen.findByText(/Checked in — BK-4242/)).toBeInTheDocument();
  });

  it('refuses a reference that belongs to no booking, without calling the server', async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    const fetchMock = mockApi(LIVE_OWNER_API);

    renderApp(<DashboardPage />);

    await screen.findByText('৳8,400');
    await userEvent.click(screen.getByRole('button', { name: /Scan player QR/i }));
    await userEvent.type(await screen.findByLabelText(/booking reference/i), 'BK-0000');
    await userEvent.click(screen.getByRole('button', { name: /^Check in$/i }));

    expect(await screen.findByText(/does not match any booking on your pitches/i)).toBeInTheDocument();
    const posts = fetchMock.mock.calls.filter(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/matchday/checkin'),
    );
    expect(posts).toHaveLength(0);
  });

  it('opens the manual booking UI directly when manual booking button is clicked and creates booking', async () => {
    signIn({ role: 'OWNER', fullName: 'Jashim Uddin' });
    const mockCalendarData = {
      pitches: [{ id: 10, name: 'Main Pitch', format: '7v7', sports: ['football'] }],
      rows: [
        {
          time: '6:00 PM',
          cells: [
            {
              slotId: 501,
              pitchId: 10,
              status: 'AVAILABLE',
              price: 2500,
            },
          ],
        },
      ],
    };

    const fetchMock = mockApi([
      ['/owner/venues/3/manual-booking', { body: null }],
      ['/owner/venues/3/calendar', { body: mockCalendarData }],
      ...LIVE_OWNER_API,
    ]);

    renderApp(<DashboardPage />);

    await screen.findByText('৳8,400');
    const manualBtn = screen.getByRole('button', { name: /\+ Manual booking/i });
    expect(manualBtn).toBeInTheDocument();
    // Ensure it's not a link to calendar page anymore
    expect(manualBtn.closest('a')).toBeNull();

    await userEvent.click(manualBtn);

    // Modal is opened
    expect(await screen.findByRole('dialog', { name: /Manual booking/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Customer name/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Customer name/i), 'Rahim Khan');
    await userEvent.type(screen.getByLabelText(/Phone number/i), '01711223344');

    const submitBtn = screen.getByRole('button', { name: /^Confirm booking$/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(
        ([url, init]) => init?.method === 'POST' && String(url).includes('/owner/venues/3/manual-booking'),
      );
      expect(calls.length).toBe(1);
      const reqBody = JSON.parse(calls[0][1].body);
      expect(reqBody.slotId).toBe(501);
      expect(reqBody.customerName).toBe('Rahim Khan');
      expect(reqBody.customerPhone).toBe('01711223344');
    });
  });
});

