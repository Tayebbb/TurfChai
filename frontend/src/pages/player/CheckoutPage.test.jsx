import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutPage from './CheckoutPage';
import { renderApp, mockApi, signIn } from '@/test/testUtils';

const heldSlot = {
  slotId: 1,
  heldUntil: new Date(Date.now() + 5 * 60000).toISOString(),
  price: 2000,
  venueId: 9,
  pitchId: 3,
  pitchName: 'Pitch 1',
  slotDate: '2026-08-20',
  startTime: '18:00:00',
  endTime: '19:30:00',
};

function mountCheckout(overrides = []) {
  return mockApi([
    ['/api/v1/bookings/hold-slot', { body: heldSlot }],
    ['/rewards/my-points', { body: { walletBalance: 0, points: 0 } }],
    ['/api/v1/venues/', { body: { name: 'Kick Off Arena', slug: 'kick-off-arena' } }],
    ...overrides,
  ]);
}

describe('CheckoutPage payment step', () => {
  beforeEach(() => {
    signIn();
  });

  it('never asks for a card number, CVV or wallet PIN', async () => {
    mountCheckout();
    renderApp(<CheckoutPage />, { route: '/player/checkout?slotId=1&venue=kick-off-arena' });

    await screen.findByText(/confirm/i, {}, { timeout: 3000 }).catch(() => null);

    // The app has no payment provider; collecting credentials it cannot use
    // and does not transmit would train players to hand them to a fake form.
    expect(screen.queryByLabelText(/card number/i)).toBeNull();
    expect(screen.queryByLabelText(/cvv/i)).toBeNull();
    expect(screen.queryByLabelText(/pin/i)).toBeNull();
    expect(screen.queryByLabelText(/expiry/i)).toBeNull();
    expect(document.querySelector('input[autocomplete="cc-number"]')).toBeNull();
    expect(document.querySelector('input[autocomplete="cc-csc"]')).toBeNull();
  });

  it('sends only the slot and method, then lands on the booking-success page', async () => {
    const fetchMock = mountCheckout([
      [
        '/api/v1/payments/checkout',
        {
          body: {
            data: { status: 'SUCCESS', bookingId: 42, bookingCode: 'TC-ABC123', pointsEarned: 20 },
          },
        },
      ],
      ['/api/v1/bookings/42', { body: { id: 42, bookingCode: 'TC-ABC123', venueName: 'Kick Off Arena' } }],
      ['/api/v1/payments/booking/42', { body: { data: [] } }],
    ]);

    renderApp(<CheckoutPage />, { route: '/player/checkout?slotId=1&venue=kick-off-arena' });

    const pay = await screen.findByRole('button', { name: /^pay .* with/i }, { timeout: 3000 });
    await userEvent.click(pay);

    const confirm = await screen.findByRole('button', { name: /confirm booking/i });
    await userEvent.click(confirm);

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/api/v1/payments/checkout'),
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(posted[1].body);
      expect(Number(body.slotId)).toBe(1);
      expect(body.method).toBeTruthy();
      expect(body.bookingMode).toBe('FULL');
      // No credential ever leaves the browser, because none is collected.
      expect(Object.keys(body)).not.toContain('cardNumber');
      expect(Object.keys(body)).not.toContain('cvv');
      expect(Object.keys(body)).not.toContain('pin');
    });
  });

  it('allows selecting squad split and calculates host share due', async () => {
    const fetchMock = mountCheckout([
      [
        '/api/v1/payments/checkout',
        {
          body: {
            data: { status: 'SUCCESS', bookingId: 42, bookingCode: 'TC-ABC123', pointsEarned: 5 },
          },
        },
      ],
      ['/api/v1/bookings/42', { body: { id: 42, bookingCode: 'TC-ABC123', venueName: 'Kick Off Arena' } }],
    ]);

    renderApp(<CheckoutPage />, { route: '/player/checkout?slotId=1&venue=kick-off-arena' });

    // Select "Split with friends"
    const splitModeBtn = await screen.findByRole('button', { name: /split with friends/i });
    await userEvent.click(splitModeBtn);

    // Verify per person breakdown is displayed (2000 / 5 = 400)
    expect(await screen.findByText(/per person/i)).toBeTruthy();

    const pay = await screen.findByRole('button', { name: /^pay .* with/i });
    await userEvent.click(pay);

    const confirm = await screen.findByRole('button', { name: /confirm booking/i });
    await userEvent.click(confirm);

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/api/v1/payments/checkout'),
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(posted[1].body);
      expect(body.bookingMode).toBe('SPLIT');
      expect(body.splitPlayerCount).toBe(5);
    });
  });

  it('releases hold and cancels booking process when cancel process is clicked', async () => {
    const fetchMock = mountCheckout([
      ['/api/v1/bookings/release-hold', { body: {} }],
    ]);

    renderApp(<CheckoutPage />, { route: '/player/checkout?slotId=1&venue=kick-off-arena' });

    const cancelButtons = await screen.findAllByRole('button', { name: /cancel process/i });
    expect(cancelButtons.length).toBeGreaterThan(0);

    await userEvent.click(cancelButtons[0]);

    await waitFor(() => {
      const releaseCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/api/v1/bookings/release-hold'),
      );
      expect(releaseCall).toBeTruthy();
      const body = JSON.parse(releaseCall[1].body);
      expect(Number(body.slotId)).toBe(1);
    });
  });
});

describe('checkout module', () => {
  it('no longer ships card formatting helpers', async () => {
    const module = await import('./CheckoutPage');
    expect(Object.keys(module)).toEqual(['default']);
    vi.resetModules();
  });
});
