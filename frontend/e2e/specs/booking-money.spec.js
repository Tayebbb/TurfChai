import { test, expect, findBookableSlot } from '../support/fixtures.js';

/**
 * The full money path, driven through the UI.
 *
 * Every assertion is cross-checked three ways: what the browser shows, what the
 * API returned, and what the backend still holds afterwards. A regression in any
 * one of those three fails the test.
 */
test.describe('booking → payment → cancellation → refund', () => {
  test('a player books, pays, and the ledger matches the booking price', async ({
    page,
    as,
    backend,
    diagnostics,
  }) => {
    const session = await as('playerA');
    const { venue, slot, date } = await findBookableSlot(session.token);

    const checkoutCalls = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/payments/checkout')) checkoutCalls.push(req.method());
    });

    await page.goto(`/player/checkout?slotId=${slot.id}&venue=${venue.slug}&date=${date}`);

    await expect(page.getByRole('heading', { name: /confirm and pay/i })).toBeVisible();
    const payButton = page.getByRole('button', { name: /^Pay ৳/ });
    await expect(payButton).toBeVisible();

    await payButton.click();
    await page.getByRole('button', { name: /confirm booking/i }).click();

    await page.waitForURL(/\/player\/booking-success/);
    const bookingId = new URL(page.url()).searchParams.get('bookingId');
    expect(bookingId, 'success page must carry the booking it created').toBeTruthy();

    // The UI claims success — confirm the backend agrees.
    const booking = await backend.get(`/bookings/${bookingId}`, session.token);
    expect(booking.status).toBe(200);
    expect(booking.data.status).toBe('CONFIRMED');

    const payments = backend.unwrap(
      (await backend.get(`/payments/booking/${bookingId}`, session.token)).data,
    );
    const charged = payments
      .filter((p) => p.type === 'BOOKING')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    expect(charged, 'payments must sum to the booking price').toBeCloseTo(
      Number(booking.data.netAmount),
      2,
    );

    expect(checkoutCalls, 'checkout must be charged exactly once').toEqual(['POST']);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.apiFailures()).toEqual([]);
  });

  test('the success page reports the amount due at the venue, not the wallet leg', async ({
    page,
    as,
    backend,
  }) => {
    const session = await as('playerA');

    // Fund the wallet so checkout is a genuine split payment.
    const points = backend.unwrap((await backend.get('/rewards/my-points', session.token)).data);
    if (Number(points.walletBalance) <= 0) {
      const redeemed = await backend.post('/rewards/redeem', { rewardId: 2 }, session.token);
      expect(redeemed.ok, 'need wallet credit to exercise a split payment').toBeTruthy();
    }
    const walletBefore = Number(
      backend.unwrap((await backend.get('/rewards/my-points', session.token)).data).walletBalance,
    );
    expect(walletBefore).toBeGreaterThan(0);

    const { venue, slot, date } = await findBookableSlot(session.token);
    await page.goto(`/player/checkout?slotId=${slot.id}&venue=${venue.slug}&date=${date}`);

    await page.getByText(/apply my wallet balance/i).click();
    await page.getByRole('button', { name: /^Pay ৳/ }).click();
    await page.getByRole('button', { name: /confirm booking/i }).click();
    await page.waitForURL(/\/player\/booking-success/);

    const bookingId = new URL(page.url()).searchParams.get('bookingId');
    const payments = backend.unwrap(
      (await backend.get(`/payments/booking/${bookingId}`, session.token)).data,
    );
    const gatewayLeg = payments.find((p) => p.type === 'BOOKING' && !p.fromWallet);
    const walletLeg = payments.find((p) => p.type === 'BOOKING' && p.fromWallet);
    expect(gatewayLeg, 'a split payment must ledger the gateway leg').toBeTruthy();
    expect(walletLeg, 'a split payment must ledger the wallet leg').toBeTruthy();

    // The headline figure must be what is still owed, never the wallet portion.
    const bdt = (n) => `৳${Math.round(Number(n)).toLocaleString('en-IN')}`;
    const summary = page.getByText(/recorded against this booking/i);
    await expect(summary).toContainText(bdt(gatewayLeg.amount));
    await expect(summary).toContainText(bdt(walletLeg.amount));
    await expect(
      summary,
      'the amount payable must be the gateway leg, not the wallet leg',
    ).toContainText(new RegExp(`${bdt(gatewayLeg.amount)}[^৳]*payable`, 'i'));

    const walletAfter = Number(
      backend.unwrap((await backend.get('/rewards/my-points', session.token)).data).walletBalance,
    );
    expect(walletAfter).toBeCloseTo(walletBefore - Number(walletLeg.amount), 2);
  });

  test('cancelling refunds by tender and releases the slot', async ({ page, as, backend }) => {
    const session = await as('playerA');
    const { venue, slot, date } = await findBookableSlot(session.token);

    await page.goto(`/player/checkout?slotId=${slot.id}&venue=${venue.slug}&date=${date}`);
    await page.getByRole('button', { name: /^Pay ৳/ }).click();
    await page.getByRole('button', { name: /confirm booking/i }).click();
    await page.waitForURL(/\/player\/booking-success/);
    const bookingId = new URL(page.url()).searchParams.get('bookingId');

    const preview = backend.unwrap(
      (await backend.get(`/payments/refund-preview/${bookingId}`, session.token)).data,
    );

    await page.goto(`/player/bookings/${bookingId}`);
    // "Total due", not "paid": nothing is settled online, it is owed to the venue.
    await expect(page.getByText(/total due/i)).toBeVisible();
    await page.getByRole('button', { name: /^cancel booking$/i }).click();

    await expect(page.getByText(/cancelled/i).first()).toBeVisible();

    const after = await backend.get(`/bookings/${bookingId}`, session.token);
    expect(after.data.status).toBe('CANCELLED');

    const ledger = backend.unwrap(
      (await backend.get(`/payments/booking/${bookingId}`, session.token)).data,
    );
    const refunded = ledger
      .filter((p) => p.type === 'REFUND')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    expect(refunded, 'refund must match what the preview promised').toBeCloseTo(
      Number(preview.refundAmount),
      2,
    );

    const paid = ledger
      .filter((p) => p.type === 'BOOKING')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    expect(refunded, 'a refund may never exceed what was taken').toBeLessThanOrEqual(paid + 0.01);

    // The slot must be sellable again.
    const slots = await backend.get(`/venues/${venue.id}/slots?date=${date}`, session.token);
    const released = slots.data.find((s) => s.id === slot.id);
    expect(released.status).toBe('AVAILABLE');
  });

  test('a cancelled booking cannot be refunded twice', async ({ as, backend }) => {
    const session = await as('playerA');
    const { slot } = await findBookableSlot(session.token);

    await backend.post('/bookings/hold-slot', { slotId: slot.id }, session.token);
    const checkout = backend.unwrap(
      (await backend.post('/payments/checkout', { slotId: slot.id, method: 'BKASH' }, session.token))
        .data,
    );

    const first = await backend.post(`/payments/cancel/${checkout.bookingId}`, null, session.token);
    expect(first.ok).toBeTruthy();

    const ledgerOf = async () =>
      backend.unwrap(
        (await backend.get(`/payments/booking/${checkout.bookingId}`, session.token)).data,
      );
    const afterFirst = (await ledgerOf()).filter((p) => p.type === 'REFUND').length;

    const second = await backend.post(`/payments/cancel/${checkout.bookingId}`, null, session.token);
    expect(second.status, 'a second refund must be refused').toBeGreaterThanOrEqual(400);

    const afterSecond = (await ledgerOf()).filter((p) => p.type === 'REFUND').length;
    expect(afterSecond, 'the refused call must not add refund rows').toBe(afterFirst);
  });

  test('a slot that has already started is not offered and cannot be paid for', async ({
    as,
    backend,
  }) => {
    const session = await as('playerA');
    const pastDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);

    const venues = await backend.get('/venues?page=0&size=50', session.token);
    let past = null;
    for (const venue of venues.data.items) {
      const slots = await backend.get(`/venues/${venue.id}/slots?date=${pastDate}`, session.token);
      if (slots.ok && Array.isArray(slots.data) && slots.data.length) {
        past = slots.data[0];
        break;
      }
    }
    test.skip(!past, 'dataset has no past-dated slots');

    expect(past.bookable, 'a started slot must not advertise itself as bookable').toBeFalsy();
    const held = await backend.post('/bookings/hold-slot', { slotId: past.id }, session.token);
    expect(held.status).toBeGreaterThanOrEqual(400);
    const paid = await backend.post(
      '/payments/checkout',
      { slotId: past.id, method: 'BKASH' },
      session.token,
    );
    expect(paid.status).toBeGreaterThanOrEqual(400);
  });
});
