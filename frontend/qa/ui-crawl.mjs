// Exhaustive route crawler.
//
// Enumerates every route in src/routes/AppRoutes.jsx, including dynamic
// parameters and redirects, and exercises each one through:
//   direct navigation, refresh, back, forward,
//   correct role, wrong role, anonymous,
//   valid ids, invalid ids, and non-existent ids.
//
//   node qa/ui-crawl.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';
const DEMO_PW = 'Demo@12345';

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
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  return r.status === 200 ? { token: r.json.token, user: r.json.user } : null;
}

async function adminLogin() {
  if (process.env.QA_ADMIN_TOKEN) return { token: process.env.QA_ADMIN_TOKEN, user: {} };
  for (let n = 0; n <= 3; n += 1) {
    const ch = await api('/admin/auth/login', {
      method: 'POST', body: { email: `admin${n}@turfchai.com`, password: DEMO_PW },
    });
    if (ch.status !== 200 || !ch.json?.devCode) continue;
    const v = await api('/admin/auth/login/verify', {
      method: 'POST', body: { challenge: ch.json.challenge, code: ch.json.devCode },
    });
    if (v.status === 200) return v.json.token ? v.json : v.json.data;
  }
  return null;
}

const IGNORED_REQUEST = [/fonts\.googleapis/, /fonts\.gstatic/, /tile\.openstreetmap/, /\/slots\/stream/];
const IGNORED_CONSOLE = [/Failed to load resource/, /Download the React DevTools/, /favicon/];

const problems = [];
function report(kind, role, route, detail) {
  problems.push({ kind, role, route, detail: String(detail).replace(/\s+/g, ' ').slice(0, 160) });
}

/** Visits one route and records everything that went wrong. */
async function visit(context, role, route, { expectDenied = false, expectErrors = false } = {}) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedApi = [];

  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORED_CONSOLE.some((re) => re.test(t))) consoleErrors.push(t);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!u.includes('/api/') || IGNORED_REQUEST.some((re) => re.test(u))) return;
    // A guard legitimately gets 401/403 when probing the wrong role, and the
    // invalid-parameter pass asks for ids that are supposed to 404/400. Only a
    // 5xx is always wrong.
    const expected = (expectDenied && [401, 403].includes(r.status()))
      || (expectErrors && r.status() < 500);
    if (r.status() >= 400 && !expected) {
      failedApi.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, '')}`);
    }
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!IGNORED_REQUEST.some((re) => re.test(u))) failedApi.push(`NETFAIL ${u.replace(BASE, '')}`);
  });

  const readState = async () => {
    const body = await page.evaluate(() => document.body.innerText);
    return {
      body,
      url: page.url().replace(BASE, ''),
      crashed: /Something went wrong|Unexpected Application Error|TypeError|undefined is not/i.test(body),
      notFound: /Page not found/i.test(body),
      blank: body.trim().length < 40,
    };
  };

  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2200);
    let s = await readState();

    if (s.crashed) report('CRASH', role, route, s.body.slice(0, 140));
    if (s.blank) report('BLANK PAGE', role, route, `${s.body.trim().length} chars rendered`);

    // Refresh must land in the same place.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const afterReload = await readState();
    if (afterReload.crashed) report('CRASH ON REFRESH', role, route, afterReload.body.slice(0, 140));
    if (afterReload.blank) report('BLANK ON REFRESH', role, route, `${afterReload.body.trim().length} chars`);

    // Back then forward must not break the app.
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const afterNav = await readState();
    if (afterNav.crashed) report('CRASH ON BACK/FORWARD', role, route, afterNav.body.slice(0, 140));

    for (const e of pageErrors) report('PAGE ERROR', role, route, e);
    for (const e of consoleErrors) report('CONSOLE ERROR', role, route, e);
    for (const e of failedApi) report('FAILED REQUEST', role, route, e);

    await page.close();
    return { ...s, deniedOrRedirected: s.notFound || s.url !== route };
  } catch (err) {
    report('NAVIGATION FAILED', role, route, err.message);
    await page.close();
    return { crashed: true, deniedOrRedirected: false };
  }
}

async function makeContext(browser, session) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (session) {
    await context.addInitScript(
      ([token, user]) => {
        // Init scripts also run on about:blank, where localStorage throws.
        // Without this guard every authenticated route reports a fake pageerror.
        try {
          localStorage.setItem('turfchai.auth.token', token);
          localStorage.setItem('turfchai.auth.user', user);
        } catch { /* not a real document yet */ }
      },
      [session.token, JSON.stringify(session.user ?? {})],
    );
  }
  return context;
}

// ---------------------------------------------------------------- fixtures --
const playerA = await login('rafi@turfchai.dev', 'demo1234');
const admin = await adminLogin();

let playerB = null;
let ownerA = null;
let ownerB = null;
if (admin) {
  for (const role of ['PLAYER', 'OWNER']) {
    const r = await api(`/admin/users?page=0&size=60&role=${role}`, { token: admin.token });
    for (const u of r.json?.data?.items ?? []) {
      if (playerB && ownerA && ownerB) break;
      const c = await login(u.email, DEMO_PW);
      if (!c) continue;
      if (c.user.role === 'PLAYER' && !playerB && c.user.id !== playerA.user.id) { playerB = c; continue; }
      if (c.user.role === 'OWNER') {
        const v = await api('/owner/venues', { token: c.token });
        if (!Array.isArray(v.json) || v.json.length === 0) continue;
        if (!ownerA) ownerA = c; else if (!ownerB) ownerB = c;
      }
    }
  }
}

// Real ids so dynamic routes are exercised with data, not just 404s.
const venues = await api('/venues?page=0&size=1');
const venueSlug = venues.json?.items?.[0]?.slug ?? 'kick-off-arena';
const bookingsA = await api('/bookings', { token: playerA.token });
const bookingId = Array.isArray(bookingsA.json) && bookingsA.json.length ? bookingsA.json[0].id : null;
const games = await api('/solo/open-games');
const gameId = Array.isArray(games.json) && games.json.length ? games.json[0].id
  : games.json?.items?.[0]?.id ?? null;
const adminVenues = admin ? await api('/admin/venues?page=0&size=1', { token: admin.token }) : null;
const turfId = Array.isArray(adminVenues?.json?.data) ? adminVenues.json.data[0]?.id : null;
const reqs = admin ? await api('/admin/turf-requests', { token: admin.token }) : null;
const requestCode = Array.isArray(reqs?.json?.data) ? reqs.json.data[0]?.requestCode : null;

console.log(`fixtures: venue=${venueSlug} booking=${bookingId} game=${gameId} turf=${turfId} request=${requestCode}`);
console.log(`actors: playerB=${playerB?.user?.email} ownerA=${ownerA?.user?.email} ownerB=${ownerB?.user?.email} admin=${Boolean(admin)}`);

// ------------------------------------------------------------------ routes --
const PUBLIC = ['/', '/auth', '/owner/onboarding', '/admin/login'];

const PLAYER_PUBLIC = [
  '/player', '/player/explore', `/player/venues/${venueSlug}`,
  '/player/checkout',
  '/solo', '/solo/open-games',
  ...(gameId ? [`/solo/games/${gameId}`] : []),
];

const PLAYER_AUTHED = [
  '/player/onboarding', '/player/booking-success', '/player/bookings',
  ...(bookingId ? [`/player/bookings/${bookingId}`] : []),
  '/player/matchday', '/player/review', '/player/cancel',
  '/player/rewards', '/player/settings',
  '/player/tournaments/TR-CUP-0091',
  '/player/tournaments/TR-CUP-0091/register',
  '/player/dashboard', '/player/dashboard/tournaments', '/player/dashboard/venues',
  '/player/dashboard/bookings',
  '/player/dashboard/stats', '/player/dashboard/wallet', '/player/dashboard/notifications',
  '/player/dashboard/settings',
  '/solo/alerts', '/solo/ticket',
  '/host', '/host/dashboard', '/host/tournament', '/host/multi-pitch', '/host/reserve',
];

const OWNER = ['/owner', '/owner/calendar', '/owner/bookings', '/owner/payments',
  '/owner/venue-setup', '/owner/customers', '/owner/promotions', '/owner/reviews'];

const ADMIN = ['/admin', '/admin/turf-requests',
  ...(requestCode ? [`/admin/turf-requests/${requestCode}`] : []),
  '/admin/turfs', ...(turfId ? [`/admin/turfs/${turfId}`] : []),
  '/admin/users', '/admin/users/growth', '/admin/users/segments',
  '/admin/activity', '/admin/payouts', '/admin/admins', '/admin/profile'];

// Invalid and hostile parameters on every dynamic route.
const BAD_PARAMS = [
  '/player/venues/does-not-exist-venue',
  '/player/venues/%3Cscript%3Ealert(1)%3C%2Fscript%3E',
  '/player/bookings/99999999',
  '/player/bookings/not-a-number',
  '/player/tournaments/NOPE-0000',
  '/solo/games/99999999',
  '/solo/games/abc',
  '/admin/turfs/99999999',
  '/admin/turfs/abc',
  '/admin/turf-requests/NOPE-0000',
  '/player/checkout?slotId=99999999&venue=nope&date=2026-08-20',
  '/player/checkout?slotId=abc',
  `/player/checkout?slotId=1&venue=${venueSlug}&date=2026-08-20`,
  '/player/review?bookingId=99999999',
  '/player/cancel?bookingId=abc',
  '/this/route/does/not/exist',
];

const browser = await chromium.launch();
let visited = 0;

async function crawl(role, session, routes, opts) {
  const context = await makeContext(browser, session);
  console.log(`crawling ${role} (${routes.length} routes)...`);
  for (const route of routes) { await visit(context, role, route, opts); visited += 1; }
  await context.close();
}

await crawl('anonymous', null, [...PUBLIC, ...PLAYER_PUBLIC]);
await crawl('playerA', playerA, [...PUBLIC, ...PLAYER_PUBLIC, ...PLAYER_AUTHED]);
if (playerB) await crawl('playerB', playerB, ['/player/bookings', '/player/rewards', '/player/dashboard']);
if (ownerA) await crawl('ownerA', ownerA, OWNER);
if (ownerB) await crawl('ownerB', ownerB, ['/owner', '/owner/calendar', '/owner/payments']);
else report('ROLE UNAVAILABLE', 'ownerB', '(all)', 'no second owner with a venue found');
if (admin) await crawl('admin', { token: admin.token, user: admin.user ?? {} }, ADMIN);
else report('ROLE UNAVAILABLE', 'admin', '(all)', 'admin sign-in failed');

// Bad parameters, crawled as the most privileged role that can reach them.
// A 4xx here is the point of the test, so only 5xx and crashes are reported.
await crawl('playerA', playerA, BAD_PARAMS.filter((r) => !r.startsWith('/admin')), { expectErrors: true });
if (admin) await crawl('admin', { token: admin.token, user: admin.user ?? {} }, BAD_PARAMS.filter((r) => r.startsWith('/admin')), { expectErrors: true });

// ---------------------------------------------------- authorization checks --
// Guarded routes must refuse the wrong role rather than render.
console.log('checking role isolation...');
const denials = [
  { role: 'anonymous', session: null, routes: ['/player/bookings', '/owner', '/admin', '/host/tournament', '/player/dashboard'] },
  { role: 'playerA', session: playerA, routes: ['/owner', '/owner/payments', '/admin', '/admin/users'] },
];
if (ownerA) denials.push({ role: 'ownerA', session: ownerA, routes: ['/admin', '/admin/users', '/admin/payouts'] });

for (const d of denials) {
  const context = await makeContext(browser, d.session);
  for (const route of d.routes) {
    const s = await visit(context, d.role, route, { expectDenied: true });
    visited += 1;
    if (!s.deniedOrRedirected && !s.crashed) {
      report('AUTHORIZATION', d.role, route, 'rendered the guarded page instead of redirecting');
    }
  }
  await context.close();
}

await browser.close();

console.log('');
if (problems.length === 0) {
  console.log(`UI CRAWL CLEAN — ${visited} route visits, no problems`);
  process.exit(0);
}
for (const p of problems) console.log(`${p.kind.padEnd(22)} ${p.role.padEnd(10)} ${p.route}  ${p.detail}`);
console.log(`\nUI CRAWL: ${problems.length} problem(s) across ${visited} route visits`);
process.exit(1);
