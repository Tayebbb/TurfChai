import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingsSection, NotificationsSection } from '@/pages/player/dashboard/PendingSections';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

/**
 * TC-003: this section rendered fine with an empty list and threw
 * `paths.player.booking is not a function` the moment a real booking arrived,
 * so the populated case is the one that matters here.
 */
describe('BookingsSection (TC-003)', () => {
  const booking = {
    id: 7,
    bookingCode: 'TC-A1B2C3',
    venueName: 'Kick Off Arena',
    bookingDate: '2026-09-01',
    startTime: '19:00:00',
    endTime: '20:30:00',
    status: 'CONFIRMED',
  };

  it('renders a populated booking list without crashing', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: { fullName: 'Test Player' } }],
      ['/bookings', { body: [booking] }],
    ]);

    renderApp(<BookingsSection />);

    expect(await screen.findByText('Kick Off Arena')).toBeInTheDocument();
  });

  it('links each booking to its detail route', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/bookings', { body: [booking] }],
    ]);

    renderApp(<BookingsSection />);

    const link = await screen.findByRole('link', { name: /Kick Off Arena/ });
    expect(link).toHaveAttribute('href', '/player/bookings/7');
  });

  it('renders a booking with no id as a non-link row rather than /bookings/undefined', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/bookings', { body: [{ ...booking, id: undefined }] }],
    ]);

    renderApp(<BookingsSection />);

    expect(await screen.findByText('Kick Off Arena')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kick Off Arena/ })).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no bookings', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/bookings', { body: [] }],
    ]);

    renderApp(<BookingsSection />);

    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
  });

  it('survives a non-array response instead of throwing on .map', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/bookings', { body: { unexpected: 'shape' } }],
    ]);

    renderApp(<BookingsSection />);

    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
  });

  it('shows a retryable error state when the request fails', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/bookings', { status: 500, body: { message: 'boom' } }],
    ]);

    renderApp(<BookingsSection />);

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('NotificationsSection', () => {
  it('renders notifications and the mark-all-read control', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/notifications', { body: [{ id: 1, title: 'Slot confirmed', body: 'See you there', isRead: false }] }],
    ]);

    renderApp(<NotificationsSection />);

    expect(await screen.findByText('Slot confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
  });

  it('does not fall through to an empty list container when the request fails', async () => {
    signIn();
    mockApi([
      ['/players/me', { body: {} }],
      ['/notifications', { status: 500, body: {} }],
    ]);

    renderApp(<NotificationsSection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
    expect(screen.queryByText('All caught up!')).not.toBeInTheDocument();
  });
});
