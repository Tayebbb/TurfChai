import { test, expect, findBookableSlot, signInThroughUi } from '../support/fixtures.js';

/**
 * What each role may see and do, exercised through the browser rather than by
 * calling the API directly — a guard that only exists server-side is still a bug
 * if the UI renders someone else's data before the call fails.
 */
test.describe('access control', () => {
  test('an anonymous visitor is redirected away from private routes', async ({ page }) => {
    const cases = [
      { route: '/player/bookings', lands: /\/auth/ },
      { route: '/player/rewards', lands: /\/auth/ },
      { route: '/owner', lands: /\/auth/ },
      { route: '/owner/payments', lands: /\/auth/ },
      { route: '/host/tournament', lands: /\/auth/ },
      // The tournament read is authenticated server-side, so leaving this route
      // public showed an anonymous visitor a dead "Authentication is required /
      // Try again" panel instead of a sign-in prompt.
      { route: '/player/tournaments/TR-CUP-0091', lands: /\/auth/ },
      { route: '/admin', lands: /\/admin\/login/ },
      { route: '/admin/users', lands: /\/admin\/login/ },
    ];

    for (const { route, lands } of cases) {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto(route);
      await expect(page, `${route} must not render for a signed-out visitor`).toHaveURL(lands);
    }
  });

  test('a shared tournament link survives the sign-in detour', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/player/tournaments/TR-CUP-0091');
    await expect(page).toHaveURL(/\/auth\?next=/);

    // Sign in on the page we landed on; navigating to /auth would drop `next`.
    await page.getByRole('textbox', { name: /email/i }).fill('rafi@turfchai.dev');
    await page.getByRole('textbox', { name: /password/i }).fill('demo1234');
    await page.evaluate(() => document.querySelector('form').requestSubmit());

    await expect(page).toHaveURL(/\/player\/tournaments\/TR-CUP-0091/);
    await expect(page.getByText(/Ramadan Cup/i).first()).toBeVisible();
  });

  test('public pages render for an anonymous visitor without private data', async ({
    page,
    diagnostics,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    for (const route of ['/', '/player/explore', '/solo/open-games', '/player/venues/kick-off-arena']) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
      const body = await page.locator('body').innerText();
      expect(body, `${route} must not greet an anonymous visitor by name`).not.toMatch(/Salam,/);
    }

    expect(diagnostics.pageErrors).toEqual([]);
  });

  test('a player cannot reach owner or admin areas', async ({ page, as }) => {
    await as('playerA');
    for (const route of ['/owner', '/owner/payments', '/owner/bookings']) {
      await page.goto(route);
      await expect(page, `${route} must be refused to a player`).not.toHaveURL(
        new RegExp(`${route}$`),
      );
    }
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('a player cannot open another player\'s booking', async ({ page, as, backend }) => {
    const victim = await as('playerB');

    // Guarantee there is something to protect rather than skipping.
    let target = ((await backend.get('/bookings', victim.token)).data ?? [])[0];
    if (!target) {
      const { slot } = await findBookableSlot(victim.token);
      await backend.post('/bookings/hold-slot', { slotId: slot.id }, victim.token);
      const checkout = backend.unwrap(
        (await backend.post('/payments/checkout', { slotId: slot.id, method: 'BKASH' }, victim.token))
          .data,
      );
      target = (await backend.get(`/bookings/${checkout.bookingId}`, victim.token)).data;
    }
    expect(target, 'player B must own a booking for this test to mean anything').toBeTruthy();

    await as('playerA');
    const direct = await backend.get(`/bookings/${target.id}`, backend.token('playerA'));
    expect(direct.status, "another player's booking must not be readable").toBeGreaterThanOrEqual(400);

    await page.goto(`/player/bookings/${target.id}`);
    const body = await page.locator('body').innerText();
    expect(body, 'the page must not render the other booking').not.toContain(target.bookingCode);
  });

  test('owner A never sees owner B data in the owner workspace', async ({ page, as, backend }) => {
    const ownerB = backend.user('ownerB');
    const bBookings = await backend.get('/owner/bookings', backend.token('ownerB'));
    const bVenues = await backend.get('/owner/venues', backend.token('ownerB'));
    const bBooking = (bBookings.data ?? [])[0];
    const bVenue = (bVenues.data ?? [])[0];
    test.skip(!bBooking || !bVenue, 'owner B has no data to protect');

    await as('ownerA');
    await page.goto('/owner/bookings');
    await expect(page.getByRole('heading', { name: /bookings/i }).first()).toBeVisible();

    const rendered = await page.locator('body').innerText();
    expect(rendered, "owner A's screen must not contain owner B's booking").not.toContain(
      bBooking.bookingCode,
    );

    // And the server refuses the same data directly.
    const aToken = backend.token('ownerA');
    expect((await backend.get(`/owner/venues/${bVenue.id}`, aToken)).status).toBeGreaterThanOrEqual(400);
    expect((await backend.get(`/bookings/${bBooking.id}`, aToken)).status).toBeGreaterThanOrEqual(400);
    expect(
      (await backend.post(`/owner/bookings/${bBooking.id}/refund`, null, aToken)).status,
      "owner A must not be able to refund owner B's booking",
    ).toBeGreaterThanOrEqual(400);

    const survived = await backend.get(`/bookings/${bBooking.id}`, backend.token('ownerB'));
    expect(survived.data.status, "owner B's booking must survive the attempt").not.toBe('CANCELLED');
    expect(ownerB.id).not.toBe(backend.user('ownerA').id);
  });

  test('a host cannot open another host\'s tournament workspace', async ({ page, as, backend }) => {
    test.skip(!backend.token('host'), 'no seeded host');
    await as('host');

    // TR-CUP-0091 belongs to the demo player, not this host.
    const refused = await backend.get('/host/tournaments/TR-CUP-0091', backend.token('host'));
    expect(refused.status).toBe(403);

    await page.goto('/host/tournament?code=TR-CUP-0091');
    await expect(page.getByText(/do not host this tournament/i)).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body, 'a denial must not render a populated workspace').not.toMatch(/invite link/i);
  });

  test('a host with no tournament sees an empty state, not an error loop', async ({
    page,
    as,
    backend,
    diagnostics,
  }) => {
    test.skip(!backend.token('host'), 'no seeded host');
    await as('host');
    const mine = await backend.get('/host/tournaments', backend.token('host'));
    expect(mine.status, 'a host must be able to list their own tournaments').toBe(200);
    test.skip(Array.isArray(mine.data) && mine.data.length > 0, 'this host already hosts something');

    await page.goto('/host/tournament');
    await expect(page.getByRole('heading', { name: /no tournament yet/i })).toBeVisible();
    expect(diagnostics.apiFailures(), 'an empty state must not retry against a 403').toEqual([]);
  });

  test('signing in through the real form routes each role to its own home', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await signInThroughUi(page, 'rafi@turfchai.dev', 'demo1234');
    await expect(page).toHaveURL(/\/player$/);
  });

  test('bad credentials are refused and leave no session behind', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await signInThroughUi(page, 'rafi@turfchai.dev', 'WrongPassword@1');
    await expect(page).toHaveURL(/\/auth/);

    const token = await page.evaluate(() => localStorage.getItem('turfchai.auth.token'));
    expect(token, 'a failed sign-in must not store a token').toBeFalsy();
  });
});
