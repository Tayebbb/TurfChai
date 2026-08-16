import { test, expect, findBookableSlot } from '../support/fixtures.js';

test.describe('player journeys', () => {
  test('every player screen loads clean, with no console or page errors', async ({
    page,
    as,
    diagnostics,
  }) => {
    await as('playerA');

    const routes = [
      '/player',
      '/player/explore',
      '/player/bookings',
      '/player/rewards',
      '/player/matchday',
      '/player/dashboard',
      '/player/dashboard/tournaments',
      '/player/dashboard/venues',
      '/player/dashboard/bookings',
      '/player/dashboard/stats',
      '/player/dashboard/wallet',
      '/player/dashboard/notifications',
      '/player/dashboard/settings',
      '/solo/open-games',
      '/solo/alerts',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page, `${route} must stay put`).toHaveURL(new RegExp(route.replace('/', '\\/')));
      const body = await page.locator('body').innerText();
      expect(body, `${route} rendered a placeholder value`).not.toMatch(
        /undefined|NaN|\[object Object\]/,
      );
    }

    expect(diagnostics.pageErrors, 'no page may throw').toEqual([]);
    expect(
      diagnostics.apiFailures(),
      `requests the app fired that failed: ${JSON.stringify(diagnostics.failedRequests, null, 2)}`,
    ).toEqual([]);
    expect(
      diagnostics.appConsoleErrors(),
      'the app itself must not log console errors',
    ).toEqual([]);
  });

  test('the bookings tabs account for every booking the API returns', async ({
    page,
    as,
    backend,
  }) => {
    const session = await as('playerA');
    const all = (await backend.get('/bookings', session.token)).data ?? [];
    test.skip(all.length === 0, 'this player has no bookings');

    await page.goto('/player/bookings');
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toBeVisible();

    const labels = await tabs.allInnerTexts();
    const counted = labels
      .map((l) => Number((l.match(/\((\d+)\)/) ?? [])[1] ?? 0))
      .reduce((a, b) => a + b, 0);

    expect(counted, 'the tab counts must add up to every booking').toBe(all.length);
  });

  test('a booking detail page reconciles its own payment ledger', async ({
    page,
    as,
    backend,
  }) => {
    const session = await as('playerA');
    const { slot } = await findBookableSlot(session.token);
    await backend.post('/bookings/hold-slot', { slotId: slot.id }, session.token);
    const checkout = backend.unwrap(
      (await backend.post('/payments/checkout', { slotId: slot.id, method: 'BKASH' }, session.token))
        .data,
    );

    await page.goto(`/player/bookings/${checkout.bookingId}`);
    await expect(page.getByRole('heading', { name: /booking/i }).first()).toBeVisible();

    const booking = (await backend.get(`/bookings/${checkout.bookingId}`, session.token)).data;
    const amount = Math.round(Number(booking.netAmount)).toLocaleString('en-IN');

    const summary = page.locator('aside, .glass-card').filter({ hasText: /payment summary/i }).first();
    await expect(summary, 'total paid must equal the booking price').toContainText(amount);
  });

  test('rewards shows the balance the API reports', async ({ page, as, backend }) => {
    const session = await as('playerA');
    const points = backend.unwrap((await backend.get('/rewards/my-points', session.token)).data);

    await page.goto('/player/rewards');
    await expect(
      page.getByText(Number(points.balance).toLocaleString('en-IN'), { exact: false }).first(),
      'the points balance must come from the API',
    ).toBeVisible();
  });

  test('redeeming a reward moves points into the wallet', async ({ as, backend }) => {
    const session = await as('playerA');
    const before = backend.unwrap((await backend.get('/rewards/my-points', session.token)).data);
    test.skip(Number(before.balance) < 1000, 'not enough points to redeem');

    const redeemed = await backend.post('/rewards/redeem', { rewardId: 2 }, session.token);
    expect(redeemed.ok).toBeTruthy();

    const after = backend.unwrap((await backend.get('/rewards/my-points', session.token)).data);
    expect(Number(after.balance), 'points must be spent').toBeLessThan(Number(before.balance));
    expect(Number(after.walletBalance), 'wallet must be credited').toBeGreaterThan(
      Number(before.walletBalance),
    );
  });

  test('a review can only be left against the reviewer\'s own booking', async ({ as, backend }) => {
    const session = await as('playerA');
    const mine = ((await backend.get('/bookings', session.token)).data ?? [])[0];
    test.skip(!mine, 'no booking to review');

    const otherSession = await as('playerB');
    const forged = await backend.post(
      '/reviews',
      { bookingId: mine.id, overallRating: 5, comment: 'not my booking' },
      otherSession.token,
    );
    expect(
      forged.status,
      "a player must not review somebody else's booking",
    ).toBeGreaterThanOrEqual(400);
  });

  test('tournaments can be browsed and registration is refused without a team', async ({
    page,
    as,
    backend,
  }) => {
    const session = await as('playerA');

    await page.goto('/player/dashboard/tournaments');
    await expect(page.getByRole('heading', { name: /tournaments/i }).first()).toBeVisible();

    const browse = await backend.get('/tournaments', session.token);
    expect(browse.status).toBe(200);

    const mine = await backend.get('/tournaments/me', session.token);
    expect(mine.status, 'a player may list their own registrations').toBe(200);

    const invalid = await backend.post('/tournaments/TR-CUP-0091/register', {}, session.token);
    expect(invalid.status, 'registration must validate its payload').toBeGreaterThanOrEqual(400);
  });

  test('open games list and a game can be created and read back', async ({ as, backend }) => {
    const session = await as('playerA');
    const before = (await backend.get('/solo/open-games', session.token)).data ?? [];

    const { venue, slot, date } = await findBookableSlot(session.token, { daysAhead: 2 });
    const created = await backend.post(
      '/solo/open-games',
      {
        title: 'E2E pickup game',
        venueId: venue.id,
        pitchId: slot.pitchId,
        gameDate: date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        skillLevel: 'INTERMEDIATE',
        capacity: 10,
        pricePerPlayer: 250,
      },
      session.token,
    );
    expect(created.ok, `open-game creation failed: ${created.status} ${JSON.stringify(created.data)}`)
      .toBeTruthy();

    const after = (await backend.get('/solo/open-games', session.token)).data ?? [];
    expect(after.length, 'the new game must appear in the feed').toBeGreaterThan(before.length);
    expect(
      after.some((g) => g.title === 'E2E pickup game'),
      'the created game must be readable back',
    ).toBeTruthy();
  });

  test('notifications endpoint backs the notifications screen', async ({ page, as, backend }) => {
    const session = await as('playerA');
    const res = await backend.get('/notifications', session.token);
    expect(res.status).toBe(200);

    await page.goto('/player/dashboard/notifications');
    await expect(page.getByRole('heading', { name: /notifications/i }).first()).toBeVisible();
  });
});

test.describe('error and loading states', () => {
  test('an unknown booking id shows an error, not a crash or somebody else\'s data', async ({
    page,
    as,
    diagnostics,
  }) => {
    await as('playerA');
    await page.goto('/player/bookings/99999999');

    await expect(page.locator('main')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body, 'an unknown booking must not render a booking').not.toMatch(/total paid/i);
    expect(diagnostics.pageErrors, 'a missing record must not throw').toEqual([]);
  });

  test('a failing API renders an error state rather than blank or fabricated content', async ({
    page,
    as,
  }) => {
    await as('playerA');

    await page.route('**/api/v1/bookings**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    );

    await page.goto('/player/bookings');
    await expect(page.locator('main')).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body, 'server wording must never reach the user').not.toContain('boom');
    expect(body, 'a failed load must not silently show an empty success state').toMatch(
      /couldn't|could not|unable|try again|went wrong|error/i,
    );
  });

  test('a slow API shows a loading state before content', async ({ page, as }) => {
    await as('playerA');

    await page.route('**/api/v1/rewards/my-points**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto('/player/rewards');
    const main = page.locator('main');
    await expect(main).toBeVisible();
    // Something must be on screen while the request is in flight.
    const early = await main.innerText();
    expect(early.length, 'a pending screen must not be blank').toBeGreaterThan(0);
  });
});
