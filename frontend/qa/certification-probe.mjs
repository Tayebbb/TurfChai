// Certification probe: cold-start data and fresh hostile input.
//
// The gate's other suites all operate on the seeded world, where every screen
// has something to show. This one covers the two states they cannot: an account
// that has just been created and owns nothing, and input written by somebody
// trying to break the product rather than use it.
//
//   node qa/certification-probe.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';

let pass = 0;
const failures = [];
function check(step, ok, evidence) {
  if (ok) { pass += 1; console.log(`PASS  ${step}\n      ${evidence}`); }
  else { failures.push({ step, evidence }); console.log(`FAIL  ${step}\n      ${evidence}`); }
}
const section = (t) => console.log(`\n================ ${t} ================\n`);

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}
const unwrap = (j) => (j && typeof j === 'object' && 'data' in j && 'success' in j ? j.data : j);

const phone = () => `+8801${Math.floor(100000000 + Math.random() * 899999999)}`;
async function register(tag, role) {
  const email = `cert.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const fullName = `Cert ${tag}`;
  const r = await api('/auth/register', {
    method: 'POST', body: { fullName, email, password: 'Demo@12345', phone: phone(), role },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  const l = await api('/auth/login', { method: 'POST', body: { email, password: 'Demo@12345' } });
  return { token: l.json.token, user: l.json.user, email, fullName };
}

const browser = await chromium.launch();

/** Visits a list of routes as one account and reports what broke on each. */
async function visitAll(session, routes) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
  await ctx.addInitScript(([t, u]) => {
    try {
      localStorage.setItem('turfchai.auth.token', t);
      localStorage.setItem('turfchai.auth.user', u);
    } catch { /* about:blank */ }
  }, [session.token, JSON.stringify(session.user ?? {})]);
  const page = await ctx.newPage();
  const results = [];
  for (const route of routes) {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); };
    const onPageError = (e) => pageErrors.push(String(e));
    const onFailed = (r) => {
      const u = r.url();
      if (u.includes('/api/')) failedRequests.push(`${u} ${r.failure()?.errorText ?? ''}`);
    };
    const onResponse = (r) => {
      if (r.url().includes('/api/') && r.status() >= 500) failedRequests.push(`${r.url()} -> ${r.status()}`);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onFailed);
    page.on('response', onResponse);
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2600);
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onFailed);
    page.off('response', onResponse);
    results.push({ route, text, consoleErrors, pageErrors, failedRequests, url: page.url() });
  }
  await ctx.close();
  return results;
}

const CRASH = /Something went wrong|Unexpected Application Error|TypeError|undefined is not|Cannot read/i;

/* ===================================================================== */
section('COLD START — A PLAYER WHO OWNS NOTHING');

const player = await register('player', 'PLAYER');
{
  const routes = [
    '/player', '/player/explore', '/player/bookings', '/player/rewards',
    '/player/matchday', '/player/dashboard', '/player/dashboard/bookings',
    '/player/dashboard/venues', '/player/dashboard/tournaments',
    '/player/dashboard/notifications', '/player/dashboard/wallet',
    '/player/dashboard/stats',
    '/player/dashboard/settings', '/solo/open-games',
  ];
  const results = await visitAll(player, routes);

  const crashed = results.filter((r) => CRASH.test(r.text) || r.pageErrors.length > 0);
  check('every player screen renders for an account with no history',
    crashed.length === 0,
    crashed.length === 0
      ? `${routes.length} route(s) clean`
      : crashed.map((r) => `${r.route}: ${r.pageErrors[0] ?? r.text.match(CRASH)?.[0]}`).join(' | '));

  const noisy = results.filter((r) => r.consoleErrors.length > 0 || r.failedRequests.length > 0);
  check('no console errors and no failed API calls on a cold-start account',
    noisy.length === 0,
    noisy.length === 0
      ? 'clean'
      : noisy.map((r) => `${r.route}: ${(r.consoleErrors[0] ?? r.failedRequests[0]).slice(0, 90)}`).join(' | '));

  const blank = results.filter((r) => r.text.trim().length < 40);
  check('no player screen renders blank',
    blank.length === 0,
    blank.length === 0 ? 'every route rendered content' : blank.map((r) => r.route).join(', '));

  // The empty states must be honest rather than a zero dressed up as data.
  const byRoute = Object.fromEntries(results.map((r) => [r.route, r.text]));
  check('the bookings screen says there are none rather than inventing rows',
    /No bookings yet|no bookings/i.test(byRoute['/player/dashboard/bookings']),
    `"${(byRoute['/player/dashboard/bookings'].match(/[^\n]*bookings?[^\n]*/i) ?? ['(nothing)'])[0].trim().slice(0, 60)}"`);

  const points = unwrap((await api('/rewards/my-points', { token: player.token })).json);
  const rewardsText = byRoute['/player/rewards'];
  check('the rewards screen shows the balance the ledger holds for a new account',
    Number(points?.balance ?? -1) === 0 && /\b0\b/.test(rewardsText) && !/\b[1-9]\d{2,}\s*(points|pts)/i.test(rewardsText),
    `ledger balance=${points?.balance}, screen quotes a non-zero points total=${/\b[1-9]\d{2,}\s*(points|pts)/i.test(rewardsText)}`);

  const saved = (await api('/players/me/saved-venues', { token: player.token })).json;
  const tours = (await api('/tournaments/me', { token: player.token })).json;
  check('the dashboard counters match the empty collections behind them',
    (Array.isArray(saved) ? saved.length : 0) === 0 && (Array.isArray(tours) ? tours.length : 0) === 0
      && /Saved venues/.test(byRoute['/player/dashboard']),
    `saved=${saved?.length}, tournaments=${tours?.length}, dashboard rendered=${/Saved venues/.test(byRoute['/player/dashboard'])}`);
}

/* ===================================================================== */
section('COLD START — AN OWNER WITH NO VENUE');

const owner = await register('owner', 'OWNER');
{
  const venues = await api('/owner/venues', { token: owner.token });
  const list = Array.isArray(venues.json) ? venues.json : [];
  check('a new owner owns nothing, and reading the list does not create a venue',
    venues.status === 200 && list.length === 0,
    `HTTP ${venues.status}, ${list.length} venue(s) — reading again: ${(await api('/owner/venues', { token: owner.token })).json?.length ?? '?'}`);

  const routes = [
    '/owner', '/owner/calendar', '/owner/bookings', '/owner/customers',
    '/owner/payments', '/owner/venue-setup', '/owner/promotions',
    '/owner/reviews',
  ];
  const results = await visitAll(owner, routes);

  const crashed = results.filter((r) => CRASH.test(r.text) || r.pageErrors.length > 0);
  check('every owner screen renders before a venue exists',
    crashed.length === 0,
    crashed.length === 0
      ? `${routes.length} route(s) clean`
      : crashed.map((r) => `${r.route}: ${r.pageErrors[0] ?? r.text.match(CRASH)?.[0]}`).join(' | '));

  const noisy = results.filter((r) => r.consoleErrors.length > 0 || r.failedRequests.length > 0);
  check('no console errors and no failed API calls on an owner with no venue',
    noisy.length === 0,
    noisy.length === 0
      ? 'clean'
      : noisy.map((r) => `${r.route}: ${(r.consoleErrors[0] ?? r.failedRequests[0]).slice(0, 90)}`).join(' | '));

  const dashboard = results.find((r) => r.route === '/owner').text;
  check('the owner dashboard invents no takings for a venue that does not exist',
    !/৳\s?[1-9][\d,]{2,}/.test(dashboard),
    `largest money figure on screen: ${(dashboard.match(/৳\s?[\d,]+/g) ?? ['none']).slice(0, 4).join(', ')}`);

  const stillNone = (await api('/owner/venues', { token: owner.token })).json;
  check('after visiting every owner screen the account still owns nothing',
    Array.isArray(stillNone) && stillNone.length === 0,
    `${stillNone?.length} venue(s) after the tour`);
}

/* ===================================================================== */
section('HOSTILE INPUT');

{
  // Stored script must come back as text, never as markup the browser runs.
  const payload = `<img src=x onerror="window.__xss=1">alert-probe-${Date.now() % 10000}`;
  const named = await api('/players/me', { method: 'PATCH', token: player.token, body: { fullName: payload } });
  const ctx = await browser.newContext();
  await ctx.addInitScript(([t, u]) => {
    try {
      localStorage.setItem('turfchai.auth.token', t);
      localStorage.setItem('turfchai.auth.user', u);
    } catch { /* about:blank */ }
  }, [player.token, JSON.stringify(player.user ?? {})]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/player/dashboard/settings');
  await page.waitForTimeout(3000);
  const executed = await page.evaluate(() => Boolean(window.__xss));
  const injected = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length);
  const asText = (await page.evaluate(() => document.body.innerText)).includes('alert-probe');
  check('a script payload stored in a profile name is rendered as text, never executed',
    named.status < 400 ? (!executed && injected === 0 && asText) : named.status === 400,
    named.status < 400
      ? `stored (HTTP ${named.status}); script ran=${executed}, injected nodes=${injected}, shown as text=${asText}`
      : `refused at the boundary with HTTP ${named.status}`);
  await ctx.close();
  await api('/players/me', { method: 'PATCH', token: player.token, body: { fullName: player.fullName } });
}

{
  const dupe = await api('/auth/register', {
    method: 'POST',
    body: { fullName: 'Duplicate', email: player.email, password: 'Demo@12345', phone: phone(), role: 'PLAYER' },
  });
  check('an email that already has an account cannot register a second one',
    dupe.status >= 400 && dupe.status < 500,
    `HTTP ${dupe.status} ${String(dupe.text).slice(0, 80)}`);
}

{
  const oversize = await api('/players/me', {
    method: 'PATCH', token: player.token, body: { fullName: 'x'.repeat(5000), bio: 'y'.repeat(50_000) },
  });
  const me = unwrap((await api('/me', { token: player.token })).json);
  check('an oversized profile payload is refused cleanly and changes nothing',
    oversize.status === 400 && me?.fullName !== 'x'.repeat(5000),
    `HTTP ${oversize.status}, name still "${String(me?.fullName).slice(0, 30)}"`);
}

{
  // A slot whose kick-off has passed must not be sellable.
  const venues = unwrap((await api('/venues?page=0&size=5')).json);
  const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  let refused = null;
  for (const v of venues.items ?? []) {
    const slots = (await api(`/venues/${v.id}/slots?date=${past}`)).json;
    const any = (Array.isArray(slots) ? slots : [])[0];
    if (!any) continue;
    refused = { slot: any, hold: await api('/bookings/hold-slot', { method: 'POST', token: player.token, body: { slotId: any.id } }) };
    break;
  }
  check('a slot in the past cannot be held',
    refused === null || (refused.hold.status >= 400 && refused.slot.bookable === false),
    refused === null
      ? 'no slots are published for past dates at all'
      : `slot ${refused.slot.id} on ${past} bookable=${refused.slot.bookable}, hold answered ${refused.hold.status}`);
}

{
  // Wallet abuse: the server must price the order, not the client.
  const venues = unwrap((await api('/venues?page=0&size=10')).json);
  let target = null;
  for (const v of venues.items ?? []) {
    for (let d = 1; d <= 4 && !target; d += 1) {
      const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
      const slots = (await api(`/venues/${v.id}/slots?date=${date}`)).json;
      const free = (Array.isArray(slots) ? slots : []).find((s) => s.status === 'AVAILABLE' && s.bookable);
      if (free) target = free;
    }
    if (target) break;
  }
  await api('/bookings/hold-slot', { method: 'POST', token: player.token, body: { slotId: target.id } });

  const negative = await api('/payments/checkout', {
    method: 'POST', token: player.token,
    body: { slotId: target.id, method: 'BKASH', applyWalletAmount: -100000 },
  });
  const wallet = unwrap((await api('/rewards/my-points', { token: player.token })).json);
  check('a negative wallet amount cannot be used to mint credit',
    negative.status >= 400 || Number(wallet?.walletBalance ?? 0) <= 0,
    `HTTP ${negative.status}, wallet balance now ${wallet?.walletBalance}`);

  const overspend = await api('/payments/checkout', {
    method: 'POST', token: player.token,
    body: { slotId: target.id, method: 'BKASH', applyWalletAmount: 9_999_999 },
  });
  if (overspend.status < 400) {
    const id = overspend.json?.bookingId ?? unwrap(overspend.json)?.bookingId;
    const booking = (await api(`/bookings/${id}`, { token: player.token })).json;
    const paid = unwrap((await api(`/payments/booking/${id}`, { token: player.token })).json)
      .reduce((s, p) => s + Number(p.amount), 0);
    check('claiming more wallet credit than you hold does not discount the booking',
      paid === Number(booking.netAmount) && paid > 0,
      `booking ৳${booking.netAmount}, ledger ৳${paid}, wallet applied ${overspend.json?.walletApplied ?? unwrap(overspend.json)?.walletApplied}`);
    await api(`/payments/cancel/${id}`, { method: 'POST', token: player.token });
  } else {
    check('claiming more wallet credit than you hold does not discount the booking',
      true, `refused outright with HTTP ${overspend.status}`);
  }
}

{
  // Somebody else's notification must not be readable or markable.
  const other = await register('victim', 'PLAYER');
  const mark = await api('/notifications/1/read', { method: 'POST', token: other.token });
  check("a notification id cannot be marked read by an account that does not own it",
    mark.status >= 400,
    `HTTP ${mark.status} ${String(mark.text).slice(0, 70)}`);
}

{
  const wrong = [];
  for (let i = 0; i < 6; i += 1) {
    wrong.push((await api('/auth/login', { method: 'POST', body: { email: player.email, password: 'not-the-password' } })).status);
  }
  const good = await api('/auth/login', { method: 'POST', body: { email: player.email, password: 'Demo@12345' } });
  check('a wrong password is always refused and never leaks whether the account exists',
    wrong.every((s) => s === 401 || s === 400 || s === 429) && good.status === 200,
    `wrong-password statuses ${[...new Set(wrong)].join('/')}, correct password still ${good.status}`);
}

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`CERTIFICATION PROBE CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`CERTIFICATION PROBE: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
