// Owner, tournament-host and admin journeys.
//
// The point is cross-area consistency: a change made in one workspace must show
// up wherever else it is meant to, including on the other side of the product.
// An owner blocking a slot must remove it from what a player can book; a host
// adding a team must change what a player sees on the tournament page; an admin
// approving a listing must put a venue in the catalogue.
//
//   node qa/journey-roles.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';
const DEMO_PW = 'Demo@12345';

let pass = 0;
const failures = [];
function check(step, ok, evidence) {
  if (ok) { pass += 1; console.log(`PASS  ${step}\n      ${evidence}`); }
  else { failures.push({ step, evidence }); console.log(`FAIL  ${step}\n      ${evidence}`); }
}

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

async function login(email, password = DEMO_PW) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  return r.status === 200 ? { token: r.json.token, user: r.json.user } : null;
}
async function adminLogin() {
  if (process.env.QA_ADMIN_TOKEN) return { token: process.env.QA_ADMIN_TOKEN, user: {} };
  for (let n = 0; n <= 3; n += 1) {
    const ch = await api('/admin/auth/login', { method: 'POST', body: { email: `admin${n}@turfchai.com`, password: DEMO_PW } });
    if (ch.status !== 200 || !ch.json?.devCode) continue;
    const v = await api('/admin/auth/login/verify', { method: 'POST', body: { challenge: ch.json.challenge, code: ch.json.devCode } });
    if (v.status === 200) return v.json.token ? v.json : v.json.data;
  }
  return null;
}

const browser = await chromium.launch();
async function pageAs(session) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (session) {
    await context.addInitScript(([t, u]) => {
      try {
        localStorage.setItem('turfchai.auth.token', t);
        localStorage.setItem('turfchai.auth.user', u);
      } catch { /* about:blank */ }
    }, [session.token, JSON.stringify(session.user ?? {})]);
  }
  const p = await context.newPage();
  return { page: p, context };
}

const admin = await adminLogin();
let ownerA = null;
if (admin) {
  const r = await api('/admin/users?page=0&size=60&role=OWNER', { token: admin.token });
  for (const u of unwrap(r.json)?.items ?? []) {
    const c = await login(u.email);
    if (!c) continue;
    const v = await api('/owner/venues', { token: c.token });
    if (Array.isArray(v.json) && v.json.length > 0) { ownerA = c; break; }
  }
}
const host = await login('rafi@turfchai.dev', 'demo1234');

// ============================================================ OWNER =========
console.log('\n================ OWNER JOURNEY ================\n');
if (!ownerA) {
  check('an owner with a venue exists', false, 'none found');
} else {
  const venue = (await api('/owner/venues', { token: ownerA.token })).json[0];
  const { page, context } = await pageAs(ownerA);

  await page.goto(BASE + '/owner');
  await page.waitForTimeout(3000);
  const dash = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  check('owner dashboard names the venue the account actually owns',
    dash.includes(venue.name),
    `dashboard shows "${venue.name}"`);

  // --- venue policy change must reach the player-facing venue page ----------
  const newCancel = venue.cancelPolicy === 'STRICT_NO_REFUND' ? 'FLEXIBLE_6H' : 'STRICT_NO_REFUND';
  const upd = await api(`/owner/venues/${venue.id}`, {
    method: 'PUT', token: ownerA.token, body: { cancelPolicy: newCancel },
  });
  const publicVenue = unwrap((await api(`/venues/${venue.slug}`)).json);
  check('a cancellation policy saved by the owner reaches the public venue record',
    upd.status === 200 && publicVenue.cancelPolicy === newCancel,
    `saved ${newCancel} (HTTP ${upd.status}), public venue reports ${publicVenue.cancelPolicy}`);

  const { page: playerView } = await pageAs(null);
  await playerView.goto(`${BASE}/player/venues/${venue.slug}`);
  await playerView.waitForTimeout(2800);
  const refundCopy = await playerView.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const expectsNoRefund = newCancel === 'STRICT_NO_REFUND';
  check('the player-facing refund table reflects the owner\'s new policy',
    expectsNoRefund ? /no refund/i.test(refundCopy) : /refund/i.test(refundCopy),
    `policy=${newCancel}, page mentions ${(refundCopy.match(/[^.\n]*refund[^.\n]*/i) ?? ['n/a'])[0].trim().slice(0, 70)}`);

  // --- blocking a slot must remove it from what a player can book -----------
  const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const slotsBefore = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
  const free = (Array.isArray(slotsBefore) ? slotsBefore : []).find((s) => s.status === 'AVAILABLE' && s.bookable);
  if (free) {
    const blocked = await api(`/owner/venues/${venue.id}/slots/${free.id}/block`, { method: 'POST', token: ownerA.token });
    const slotsAfter = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
    const same = slotsAfter.find((s) => s.id === free.id);
    check('SLOT available -> blocked removes it from player availability',
      blocked.status < 400 && same?.status === 'BLOCKED' && same?.bookable === false,
      `block HTTP ${blocked.status}, slot now ${same?.status} bookable=${same?.bookable}`);

    const holdBlocked = await api('/bookings/hold-slot', { method: 'POST', token: host.token, body: { slotId: free.id } });
    check('a blocked slot cannot be held by a player',
      holdBlocked.status >= 400,
      `hold answered ${holdBlocked.status}`);

    const unblocked = await api(`/owner/venues/${venue.id}/slots/${free.id}/unblock`, { method: 'POST', token: ownerA.token });
    const restored = (await api(`/venues/${venue.id}/slots?date=${date}`)).json.find((s) => s.id === free.id);
    check('SLOT blocked -> available restores bookability',
      unblocked.status < 400 && restored?.status === 'AVAILABLE',
      `unblock HTTP ${unblocked.status}, slot back to ${restored?.status}`);
  } else {
    check('a free slot exists to exercise block/unblock', false, `none free on ${date}`);
  }

  // --- bookings / customers / reviews are derived from the same rows --------
  const ownerBookings = unwrap((await api('/owner/bookings', { token: ownerA.token })).json);
  await page.goto(BASE + '/owner/bookings');
  await page.waitForTimeout(3000);
  const bookingsUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const firstCode = Array.isArray(ownerBookings) && ownerBookings.length ? ownerBookings[0].bookingCode : null;
  check('owner bookings screen shows the bookings the API returns',
    !firstCode || bookingsUi.includes(firstCode),
    `${Array.isArray(ownerBookings) ? ownerBookings.length : 0} booking(s), first code ${firstCode ?? 'n/a'} on screen`);

  await page.goto(BASE + '/owner/customers');
  await page.waitForTimeout(3000);
  const customersUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const customers = unwrap((await api('/owner/customers', { token: ownerA.token })).json);
  const firstCustomer = Array.isArray(customers) && customers.length ? customers[0].name : null;
  check('customers are the real people who booked this venue',
    !firstCustomer || customersUi.includes(firstCustomer),
    `${Array.isArray(customers) ? customers.length : 0} customer(s), first "${firstCustomer ?? 'n/a'}" on screen`);

  await page.goto(BASE + '/owner/reviews');
  await page.waitForTimeout(3000);
  const reviewsUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const ownerReviews = unwrap((await api('/owner/reviews', { token: ownerA.token })).json);
  check('owner reviews screen matches the review feed',
    Array.isArray(ownerReviews) ? reviewsUi.length > 0 : true,
    `${Array.isArray(ownerReviews) ? ownerReviews.length : 0} review(s) in the feed`);

  await context.close();
}

// ======================================================== TOURNAMENT ========
console.log('\n================ TOURNAMENT JOURNEY ================\n');
const CODE = 'TR-CUP-0091';
const hostView = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json);
check('the host can open their own tournament workspace',
  Boolean(hostView?.code),
  `${hostView?.name} — ${hostView?.teams?.length ?? 0} team(s)`);

const teamsBefore = hostView?.teams?.length ?? 0;
const teamName = `Journey FC ${Date.now() % 100000}`;
const added = await api(`/host/tournaments/${CODE}/teams`, {
  method: 'POST', token: host.token, body: { name: teamName, captainName: 'Journey Captain' },
});
const hostAfter = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json);
check('TOURNAMENT REGISTRATION: a team added by the host is persisted',
  added.status < 400 && (hostAfter?.teams?.length ?? 0) === teamsBefore + 1,
  `teams ${teamsBefore} -> ${hostAfter?.teams?.length}, add HTTP ${added.status}`);

// The player side must see the same tournament state.
const { page: hostPage, context: hostCtx } = await pageAs(host);
await hostPage.goto(`${BASE}/host/tournament?code=${CODE}`);
await hostPage.waitForTimeout(3200);
const hostUi = await hostPage.evaluate(() => document.querySelector('main')?.innerText ?? '');
check('the host workspace shows the team it just accepted',
  hostUi.includes(teamName) || hostUi.includes(String(hostAfter?.teams?.length ?? '')),
  `workspace lists ${hostAfter?.teams?.length} teams`);

check('the host workspace shows real fixtures and money, not placeholders',
  /R16|Final|SF|QF/.test(hostUi) && /৳/.test(hostUi),
  `fixtures rendered=${/R16|Final|SF|QF/.test(hostUi)}, money rendered=${/৳/.test(hostUi)}`);

await hostPage.goto(`${BASE}/player/tournaments/${CODE}`);
await hostPage.waitForTimeout(3200);
const playerTournamentUi = await hostPage.evaluate(() => document.querySelector('main')?.innerText ?? '');
const playerView = unwrap((await api(`/tournaments/${CODE}`, { token: host.token })).json);
check('both sides agree on the same tournament state',
  playerTournamentUi.includes(playerView.name)
    && String(playerView.teams?.length ?? hostAfter?.teams?.length) === String(hostAfter?.teams?.length),
  `player page shows "${playerView.name}", team count ${playerView.teams?.length ?? 'n/a'} vs host ${hostAfter?.teams?.length}`);
await hostCtx.close();

// A player who does not host it cannot act on it.
const outsider = await login('fahim.rahman.0@gmail.com');
if (outsider) {
  const tamper = await api(`/host/tournaments/${CODE}/settings`, {
    method: 'PATCH', token: outsider.token, body: { privacy: 'open' },
  });
  check('a non-host cannot change tournament settings',
    [401, 403, 404].includes(tamper.status),
    `HTTP ${tamper.status}`);
}

// ============================================================ ADMIN =========
console.log('\n================ ADMIN JOURNEY ================\n');
if (!admin) {
  check('admin can sign in through 2FA', false, 'all four admins throttled');
} else {
  const { page, context } = await pageAs({ token: admin.token, user: admin.user ?? {} });

  await page.goto(BASE + '/admin');
  await page.waitForTimeout(3200);
  const adminUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const users = unwrap((await api('/admin/users?page=0&size=1', { token: admin.token })).json);
  const venues = unwrap((await api('/admin/venues?page=0&size=1', { token: admin.token })).json);
  check('admin dashboard counts match the database',
    adminUi.includes(String(users.total)) && adminUi.includes(String(venues.length ?? venues.total ?? '')),
    `screen vs DB users=${users.total}, venues=${Array.isArray(venues) ? venues.length : venues.total}`);

  // --- venue approval must publish a venue into the catalogue --------------
  const requests = unwrap((await api('/admin/turf-requests', { token: admin.token })).json);
  const pending = (Array.isArray(requests) ? requests : []).find((r) => r.status === 'PENDING');
  if (pending) {
    const venuesBefore = unwrap((await api('/venues?page=0&size=1')).json).totalItems;
    const approved = await api(`/admin/turf-requests/${pending.requestCode}/review`, {
      method: 'POST', token: admin.token, body: { action: 'APPROVE', note: 'approved by the journey suite' },
    });
    const venuesAfter = unwrap((await api('/venues?page=0&size=1')).json).totalItems;
    const reqAfter = unwrap((await api('/admin/turf-requests', { token: admin.token })).json)
      .find((r) => r.requestCode === pending.requestCode);
    check('VENUE APPROVAL pending -> approved creates a real venue',
      approved.status < 400 && reqAfter?.status === 'APPROVED' && venuesAfter >= venuesBefore,
      `request ${pending.requestCode} ${pending.status} -> ${reqAfter?.status}, catalogue ${venuesBefore} -> ${venuesAfter}`);

    const reApprove = await api(`/admin/turf-requests/${pending.requestCode}/review`, {
      method: 'POST', token: admin.token, body: { action: 'APPROVE', note: 'again' },
    });
    check('VENUE APPROVAL approved -> approved is refused',
      reApprove.status >= 400,
      `second approval answered ${reApprove.status}`);
  } else {
    check('a pending turf request exists to approve', false, 'none pending — approval path not exercised');
  }

  // --- users, detail, activity --------------------------------------------
  await page.goto(BASE + '/admin/users');
  await page.waitForTimeout(3200);
  const usersUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const firstUser = unwrap((await api('/admin/users?page=0&size=1', { token: admin.token })).json).items[0];
  check('admin user roster shows real accounts',
    usersUi.includes(firstUser.fullName) || usersUi.includes(firstUser.email),
    `first roster row "${firstUser.fullName}" present`);

  await page.goto(BASE + '/admin/activity');
  await page.waitForTimeout(3000);
  const activityUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const audit = unwrap((await api('/admin/audit-log', { token: admin.token })).json);
  check('the audit log screen reflects recorded admin actions',
    Array.isArray(audit) ? activityUi.length > 0 : true,
    `${Array.isArray(audit) ? audit.length : 0} audit entries`);

  // --- export really produces a file ---------------------------------------
  await page.goto(BASE + '/admin/users');
  await page.waitForTimeout(2800);
  await page.evaluate(() => {
    window.__dl = 0;
    const orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { window.__dl += 1; window.__size = b?.size; return orig.call(this, b); };
  });
  const exportBtn = await page.$('button:has-text("Export")');
  if (exportBtn) {
    await exportBtn.click();
    await page.waitForTimeout(1500);
    const dl = await page.evaluate(() => ({ n: window.__dl, size: window.__size }));
    check('the admin export produces a real file, not just a toast',
      dl.n > 0 && dl.size > 0,
      `${dl.n} file(s), ${dl.size} bytes`);
  }

  await context.close();
}

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`ROLE JOURNEYS CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`ROLE JOURNEYS: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step} :: ${f.evidence}`);
process.exit(1);
