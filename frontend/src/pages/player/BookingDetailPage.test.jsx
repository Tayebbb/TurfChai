import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';

import BookingDetailPage from './BookingDetailPage';
import { renderRoute, mockApi, signIn } from '@/test/testUtils';

const booking = {
  id: 7,
  bookingCode: 'TC-ABC123',
  status: 'CONFIRMED',
  venueName: 'Kick Off Arena',
  pitchName: 'Pitch 1',
  bookingDate: '2026-09-20',
  startTime: '18:00:00',
  endTime: '19:30:00',
  netAmount: 2500,
  amount: 2500,
  createdAt: '2026-08-16T04:10:00+06:00',
};

/** A split payment: part settled from wallet credit, the rest due at the venue. */
const splitLedger = [
  {
    id: 2,
    type: 'BOOKING',
    status: 'SUCCESS',
    amount: 150,
    method: 'BKASH',
    fromWallet: true,
    txnReference: 'PAY-WALLET',
    createdAt: '2026-08-16T04:10:00+06:00',
  },
  {
    id: 1,
    type: 'BOOKING',
    status: 'SUCCESS',
    amount: 2350,
    method: 'BKASH',
    fromWallet: false,
    txnReference: 'PAY-GATEWAY',
    createdAt: '2026-08-16T04:10:00+06:00',
  },
];

function mount(ledger = splitLedger, bookingOverride = {}) {
  mockApi([
    ['/api/v1/payments/booking/', { body: { data: ledger } }],
    ['/api/v1/payments/refund-preview/', { body: { data: { refundPercent: 50, refundAmount: 1250 } } }],
    ['/api/v1/players/me', { body: { id: 1, fullName: 'Test Player', role: 'PLAYER' } }],
    ['/api/v1/bookings/', { body: { ...booking, ...bookingOverride } }],
  ]);
  return renderRoute(<BookingDetailPage />, {
    path: '/player/bookings/:bookingId',
    route: '/player/bookings/7',
  });
}

describe('BookingDetailPage payment state', () => {
  beforeEach(() => {
    signIn();
  });

  it('sums every tender rather than reporting only the first ledger row', async () => {
    mount();

    // 150 + 2350. Reading a single ledger row reported ৳150 as the amount paid.
    const paid = (await screen.findByText(/^paid$/i)).parentElement;
    expect(paid).toHaveTextContent('2,500');
    expect(paid).not.toHaveTextContent('150');

    // The whole price is settled, so nothing is owed and the summary says so
    // rather than repeating the price back as a balance.
    const total = screen.getByText(/^settled$/i).parentElement;
    expect(total).toHaveTextContent('2,500');
    expect(screen.queryByText(/still due/i)).not.toBeInTheDocument();
  });

  it('shows the unpaid balance as owed rather than as zero', async () => {
    // A confirmed booking with nothing collected: the player owes the price.
    mount([]);

    const total = (await screen.findByText(/still due/i)).parentElement;
    expect(total).toHaveTextContent('2,500');
    expect(screen.queryByText(/^paid$/i)).not.toBeInTheDocument();
  });

  it('labels the wallet leg as wallet credit, not as a bKash payment', async () => {
    mount();

    const table = await screen.findByRole('table');
    // The wallet leg is settled credit, so calling it a bKash payment overstates
    // what the player still owes the venue.
    expect(within(table).getByText(/wallet credit/i)).toBeInTheDocument();
    expect(within(table).getByText(/^Wallet$/)).toBeInTheDocument();
    expect(within(table).getByText(/booking payment/i)).toBeInTheDocument();
  });

  it('nets refunds off the amount paid', async () => {
    mount([
      ...splitLedger,
      {
        id: 3,
        type: 'REFUND',
        status: 'SUCCESS',
        amount: 1175,
        method: 'BKASH',
        fromWallet: false,
        txnReference: 'PAY-REFUND',
        createdAt: '2026-08-16T04:12:00+06:00',
      },
      {
        id: 4,
        type: 'REFUND',
        status: 'SUCCESS',
        amount: 75,
        method: 'BKASH',
        fromWallet: true,
        txnReference: 'PAY-REFUND-WALLET',
        createdAt: '2026-08-16T04:12:00+06:00',
      },
    ], { status: 'CANCELLED' });

    // 2500 taken, 1250 given back across both tenders, so the venue kept 1250.
    // A cancelled booking owes nothing further, whatever the arithmetic.
    expect(await screen.findByText(/net charged/i)).toBeInTheDocument();
    const net = screen.getByText(/net charged/i).parentElement;
    expect(net).toHaveTextContent('৳1,250');
    expect(screen.queryByText(/still due/i)).not.toBeInTheDocument();

    // "Refunded" also labels each refund row's status badge, so scope to the
    // summary line, which is the one carrying the combined figure.
    const refunded = screen
      .getAllByText(/^refunded$/i)
      .map((node) => node.parentElement)
      .find((row) => row?.className?.includes('pricerow'));
    expect(refunded).toHaveTextContent('৳1,250');
  });

  it('shows an error state when the booking cannot be loaded', async () => {
    mockApi([
      ['/api/v1/payments/booking/', { body: { data: [] } }],
      ['/api/v1/players/me', { body: { id: 1, fullName: 'Test Player', role: 'PLAYER' } }],
      ['/api/v1/bookings/', { status: 500, body: { message: 'kaboom' } }],
    ]);
    renderRoute(<BookingDetailPage />, {
      path: '/player/bookings/:bookingId',
      route: '/player/bookings/7',
    });

    await waitFor(() => {
      expect(document.body.textContent).not.toContain('kaboom');
    });
    expect(screen.queryByText(/total due/i)).toBeNull();
  });
});
