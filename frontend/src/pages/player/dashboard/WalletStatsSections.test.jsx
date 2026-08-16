import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsSection, WalletSection } from './PendingSections';
import { renderApp, mockApi, signIn } from '@/test/testUtils';

describe('WalletSection', () => {
  beforeEach(() => signIn());

  it('shows the balance and the ledger behind it', async () => {
    mockApi([
      [
        '/rewards/wallet',
        {
          body: {
            data: {
              balance: 150,
              entries: [
                {
                  id: 1,
                  delta: 200,
                  reason: 'REWARD_CREDIT',
                  label: 'Reward credit',
                  createdAt: '2026-08-10T10:00:00Z',
                },
                {
                  id: 2,
                  delta: -50,
                  reason: 'BOOKING_PAYMENT',
                  label: 'Spent on a booking',
                  bookingId: 9,
                  createdAt: '2026-08-11T10:00:00Z',
                },
              ],
            },
          },
        },
      ],
    ]);

    renderApp(<WalletSection />);

    expect(await screen.findByText(/reward credit/i)).toBeInTheDocument();
    expect(screen.getByText(/spent on a booking/i)).toBeInTheDocument();
    expect(screen.getByText(/booking #9/i)).toBeInTheDocument();
  });

  it('says the wallet is empty rather than inventing entries', async () => {
    mockApi([['/rewards/wallet', { body: { data: { balance: 0, entries: [] } } }]]);
    renderApp(<WalletSection />);
    expect(await screen.findByText(/no wallet activity yet/i)).toBeInTheDocument();
  });

  it('surfaces a load failure with a retry', async () => {
    mockApi([['/rewards/wallet', { status: 500, body: { message: 'boom' } }]]);
    renderApp(<WalletSection />);
    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });
});

describe('StatsSection', () => {
  beforeEach(() => signIn());

  it('renders figures computed from the caller’s own bookings', async () => {
    mockApi([
      [
        '/players/me/stats',
        {
          body: {
            totalBookings: 12,
            completedBookings: 9,
            cancelledBookings: 1,
            upcomingBookings: 2,
            checkedInCount: 7,
            venuesPlayed: 3,
            openGamesJoined: 4,
            reviewsWritten: 2,
            reliabilityScore: 92,
            totalSpent: 24000,
            favouriteVenueName: 'Kick Off Arena',
            bookingsByMonth: [{ month: '2026-08', bookings: 5 }],
          },
        },
      ],
    ]);

    renderApp(<StatsSection />);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('Kick Off Arena')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    // No score is ever recorded, so no win rate may be shown.
    expect(screen.queryByText(/win rate/i)).toBeNull();
    expect(screen.getByText(/does not record match scores/i)).toBeInTheDocument();
  });

  it('shows an empty state instead of zeros dressed up as achievements', async () => {
    mockApi([['/players/me/stats', { body: { totalBookings: 0, bookingsByMonth: [] } }]]);
    renderApp(<StatsSection />);
    expect(await screen.findByText(/nothing to measure yet/i)).toBeInTheDocument();
  });
});

describe('wallet retry', () => {
  beforeEach(() => signIn());

  it('refetches when the user retries', async () => {
    const fetchMock = mockApi([['/rewards/wallet', { status: 500, body: {} }]]);
    renderApp(<WalletSection />);
    const retry = await screen.findByRole('button', { name: /try again|retry/i });
    const before = fetchMock.mock.calls.length;
    await userEvent.click(retry);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});
