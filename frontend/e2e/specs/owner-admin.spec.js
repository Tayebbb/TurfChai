import { test, expect } from '../support/fixtures.js';

test.describe('owner workspace', () => {
  test('every owner screen loads real data with no failed calls', async ({
    page,
    as,
    diagnostics,
  }) => {
    await as('ownerA');

    const routes = [
      '/owner',
      '/owner/calendar',
      '/owner/bookings',
      '/owner/payments',
      '/owner/venue-setup',
      '/owner/customers',
      '/owner/promotions',
      '/owner/reviews',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page, `${route} must not bounce the owner out`).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator('main, .dash-main').first()).toBeVisible();
      const body = await page.locator('body').innerText();
      expect(body, `${route} rendered a placeholder value`).not.toMatch(/undefined|NaN|\[object Object\]/);
    }

    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.apiFailures()).toEqual([]);
  });

  test('the payments KPI row is internally consistent', async ({ page, as }) => {
    await as('ownerA');
    await page.goto('/owner/payments');

    // The KPIs arrive from the API and count up, so wait for the row to settle.
    await expect(page.getByText(/net to you/i)).toBeVisible();
    await expect(page.getByText(/gross − fees − refunds/i)).toBeVisible();

    const read = async (label) => {
      const text = await page.locator('body').innerText();
      const match = text.match(new RegExp(`${label}[^৳]*৳\\s*([\\d,]+)`, 'i'));
      return match ? Number(match[1].replace(/,/g, '')) : null;
    };

    await expect
      .poll(async () => read('NET TO YOU'), { message: 'net KPI must render' })
      .not.toBeNull();

    const gross = await read('GROSS');
    const fees = await read('PLATFORM FEES');
    const refunds = await read('REFUNDS');
    const net = await read('NET TO YOU');

    expect(gross, 'gross KPI must render').not.toBeNull();
    // The caption on this row literally says "Gross − fees − refunds".
    expect(net, 'net must equal gross minus fees minus refunds').toBeCloseTo(
      gross - fees - refunds,
      0,
    );
  });

  test('owner bookings list matches what the API returns', async ({ page, as, backend }) => {
    await as('ownerA');
    const apiBookings = (await backend.get('/owner/bookings', backend.token('ownerA'))).data ?? [];
    // The screen opens on the "Today" filter, so compare like with like.
    const today = new Date().toISOString().slice(0, 10);
    const todays = apiBookings.filter((b) => b.bookingDate === today);
    test.skip(todays.length === 0, 'owner A has no bookings today');

    await page.goto('/owner/bookings');
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    await expect(table, "today's bookings must appear in the table").toContainText(
      todays[0].bookingCode,
    );
  });

  test('an owner refund moves the booking to cancelled and is reflected on reload', async ({
    page,
    as,
    backend,
  }) => {
    const token = backend.token('ownerA');
    const bookings = (await backend.get('/owner/bookings', token)).data ?? [];
    const target = bookings.find((b) => b.status === 'CONFIRMED');
    test.skip(!target, 'owner A has no confirmed booking to refund');

    await as('ownerA');
    const refunded = await backend.post(`/owner/bookings/${target.id}/refund`, null, token);
    expect(refunded.ok, 'the venue owner may refund their own booking').toBeTruthy();

    const after = (await backend.get('/owner/bookings', token)).data.find((b) => b.id === target.id);
    expect(after.status).toBe('CANCELLED');

    await page.goto('/owner/bookings');
    const row = page.locator('tr', { hasText: target.bookingCode });
    if (await row.count()) {
      await expect(row.first()).toContainText(/cancel/i);
    }
  });
});

test.describe('admin console', () => {
  test('every admin screen loads real data with no failed calls', async ({
    page,
    as,
    diagnostics,
  }) => {
    await as('admin');

    const routes = [
      '/admin',
      '/admin/turf-requests',
      '/admin/turfs',
      '/admin/users',
      '/admin/users/growth',
      '/admin/users/segments',
      '/admin/activity',
      '/admin/payouts',
      '/admin/admins',
      '/admin/profile',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page, `${route} must not bounce the admin to login`).not.toHaveURL(/\/admin\/login/);
      const body = await page.locator('body').innerText();
      expect(body, `${route} rendered a placeholder value`).not.toMatch(/undefined|NaN|\[object Object\]/);
    }

    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.apiFailures()).toEqual([]);
  });

  test('user segments show the real user base, not estimates', async ({ page, as, backend }) => {
    await as('admin');
    const segments = backend.unwrap(
      (await backend.get('/admin/analytics/segments', backend.token('admin'))).data,
    );

    await page.goto('/admin/users/segments');

    // The counters animate up from zero, so these must be retrying assertions.
    const legend = page.locator('.user-breakdown-legend');
    await expect(legend).toContainText(Number(segments.playerCount).toLocaleString('en-IN'));
    await expect(legend).toContainText(Number(segments.hostCount).toLocaleString('en-IN'));
    await expect(
      page.getByText(Number(segments.totalUsers).toLocaleString('en-IN'), { exact: false }).first(),
      'the donut total must be the real user count',
    ).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body, 'the invented 41.2K figure must never come back').not.toContain('41.2K');
    expect(body, 'the invented player count must never come back').not.toContain('34,200');
  });

  test('the turf request queue matches the API and opens a real request', async ({
    page,
    as,
    backend,
  }) => {
    await as('admin');
    const requests = backend.unwrap(
      (await backend.get('/admin/turf-requests', backend.token('admin'))).data,
    );
    const list = Array.isArray(requests) ? requests : (requests?.content ?? []);
    test.skip(list.length === 0, 'no turf requests seeded');

    await page.goto('/admin/turf-requests');
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    // The default tab filters to pending, so assert against a pending code.
    const pending = list.find((r) => r.status === 'PENDING') ?? list[0];
    await expect(table, 'the queue must list a real request code').toContainText(pending.requestCode);
  });

  test('admin approval moves a pending request out of the pending queue', async ({
    as,
    backend,
  }) => {
    await as('admin');
    const token = backend.token('admin');
    const payload = backend.unwrap((await backend.get('/admin/turf-requests', token)).data);
    const list = Array.isArray(payload) ? payload : (payload?.content ?? []);
    const pending = list.find((r) => r.status === 'PENDING');
    test.skip(!pending, 'no pending turf request to approve');

    const approved = await backend.post(
      `/admin/turf-requests/${pending.requestCode}/review`,
      { action: 'APPROVE', note: 'approved by the e2e suite' },
      token,
    );
    expect(approved.ok, 'an admin may approve a pending request').toBeTruthy();

    const after = backend.unwrap((await backend.get('/admin/turf-requests', token)).data);
    const afterList = Array.isArray(after) ? after : (after?.content ?? []);
    const reloaded = afterList.find((r) => r.requestCode === pending.requestCode);
    expect(reloaded.status, 'the request must no longer be pending').toBe('APPROVED');
  });

  test('the admin profile reports only actions the audit trail records', async ({
    page,
    as,
    backend,
  }) => {
    await as('admin');
    const me = backend.user('admin');
    const audit = backend.unwrap(
      (await backend.get('/admin/audit-log?page=0&size=100', backend.token('admin'))).data,
    );
    const mine = (audit.content ?? []).filter((e) => e.adminName === me.fullName);

    await page.goto('/admin/profile');
    await expect(page.getByText(/logged actions/i)).toBeVisible();
    await expect(
      page.getByText(`${mine.length} Actions`),
      'the action count must come from the audit trail',
    ).toBeVisible();
  });
});
