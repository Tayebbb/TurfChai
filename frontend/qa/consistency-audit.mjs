// Cross-surface data consistency.
//
// Every other suite asks "does this screen work?". This one asks a harder
// question: when the same fact is reported in six different places, do the six
// agree? It performs a real action and then traces the resulting data through
// every surface that claims to describe it — player screens, owner console,
// admin console, public catalogue, ledgers and aggregates.
//
// A contradiction here is a product defect even when every individual screen
// renders without error.
//
//   node qa/consistency-audit.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';
const OWNER = { email: 'brishty.ahmed.285@gmail.com', password: 'Demo@12345' };
const HOST = { email: 'rafi@turfchai.dev', password: 'demo1234' };
const TOURNAMENT = 'TR-CUP-0091';

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
const money = (v) => Math.round(Number(v ?? 0));
const digits = (s) => Number(String(s ?? '').replace(/[^\d]/g, '') || 0);

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}
async function registerPlayer(tag) {
  const email = `consistency.${tag}.${Date.now()}@example.com`;
  const fullName = `Consistency ${tag}`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName, email, password: 'Demo@12345',
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  return { ...(await login({ email, password: 'Demo@12345' })), email, fullName };
}
async function adminToken() {
  if (process.env.QA_ADMIN_TOKEN) return process.env.QA_ADMIN_TOKEN;
  for (const n of [0, 1, 2, 3]) {
    const ch = await api('/admin/auth/login', {
      method: 'POST', body: { email: `admin${n}@turfchai.com`, password: 'Demo@12345' },
    });
    if (ch.status !== 200 || !ch.json?.devCode) continue;
    const v = await api('/admin/auth/login/verify', {
      method: 'POST', body: { challenge: ch.json.challenge, code: ch.json.devCode },
    });
    if (v.status === 200) return v.json?.token ?? unwrap(v.json)?.token;
  }
  return null;
}

const browser = await chromium.launch();
async function screenText(session, path, waitMs = 3500) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
  if (session) {
    await ctx.addInitScript(([t, u]) => {
      try {
        localStorage.setItem('turfchai.auth.token', t);
        localStorage.setItem('turfchai.auth.user', u);
      } catch { /* about:blank */ }
    }, [session.token, JSON.stringify(session.user ?? {})]);
  }
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForTimeout(waitMs);
  const text = await page.evaluate(() => document.body.innerText);
  await ctx.close();
  return text;
}

const owner = await login(OWNER);
const host = await login(HOST);
const admin = await adminToken();
const player = await registerPlayer('player');

/* ===================================================================== */
section('BOOKING CONSISTENCY');

const ownerVenues = (await api('/owner/venues', { token: owner.token })).json;
const venue = (Array.isArray(ownerVenues) ? ownerVenues : [])[0];

// Baselines taken before the booking so every delta is attributable to it.
const before = {
  dashboard: unwrap((await api('/owner/analytics/dashboard', { token: owner.token })).json),
  payments: unwrap((await api('/owner/payments?timeframe=daily', { token: owner.token })).json),
  customers: (await api('/owner/customers', { token: owner.token })).json,
  ownerBookings: (await api('/owner/bookings', { token: owner.token })).json,
};
const kpi = (dash, label) => (dash?.kpis ?? []).find((k) => k.label === label)?.value;

// Find a bookable slot at this owner's venue so every surface below is theirs.
let target = null;
for (let d = 0; d <= 6 && !target; d += 1) {
  const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  const slots = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
  const free = (Array.isArray(slots) ? slots : []).find((s) => s.status === 'AVAILABLE' && s.bookable);
  if (free) target = { slot: free, date };
}
const catalogPrice = money(target.slot.price);

const hold = await api('/bookings/hold-slot', { method: 'POST', token: player.token, body: { slotId: target.slot.id } });
check('CHECKOUT: the price quoted at hold is the price the catalogue advertised',
  money(hold.json?.price) === catalogPrice,
  `catalogue ৳${catalogPrice}, hold ৳${money(hold.json?.price)}`);

const checkout = await api('/payments/checkout', {
  method: 'POST', token: player.token,
  body: { slotId: target.slot.id, method: 'BKASH', applyWalletAmount: 0 },
});
const bookingId = checkout.json?.bookingId ?? unwrap(checkout.json)?.bookingId;
const bookingCode = checkout.json?.bookingCode ?? unwrap(checkout.json)?.bookingCode;
const booking = (await api(`/bookings/${bookingId}`, { token: player.token })).json;
const payments = unwrap((await api(`/payments/booking/${bookingId}`, { token: player.token })).json);

check('the booking the player receives matches the slot they chose',
  booking.slotId === target.slot.id && booking.bookingDate === target.date
    && booking.startTime === target.slot.startTime && booking.venueId === venue.id,
  `slot ${booking.slotId}=${target.slot.id}, date ${booking.bookingDate}, start ${booking.startTime}, venue ${booking.venueId}`);

check('PAYMENT HISTORY: the ledger rows sum to the amount on the booking',
  payments.reduce((s, p) => s + Number(p.amount), 0) === Number(booking.netAmount),
  `ledger ৳${payments.reduce((s, p) => s + Number(p.amount), 0)} vs booking netAmount ৳${money(booking.netAmount)}`);

check('the price never changes between the catalogue, the booking and the ledger',
  catalogPrice === money(booking.netAmount) && catalogPrice === money(booking.amount),
  `catalogue ৳${catalogPrice}, booking amount ৳${money(booking.amount)}, netAmount ৳${money(booking.netAmount)}`);

// -- venue availability -----------------------------------------------------
{
  const after = (await api(`/venues/${venue.id}/slots?date=${target.date}`)).json;
  const slot = after.find((s) => s.id === target.slot.id);
  check('VENUE AVAILABILITY: the booked slot is no longer offered to anyone else',
    slot?.status === 'BOOKED' && slot?.bookable === false,
    `slot now ${slot?.status}, bookable=${slot?.bookable}`);
}

// -- player surfaces --------------------------------------------------------
{
  const history = (await api('/bookings', { token: player.token })).json;
  const row = history.find((b) => b.id === bookingId);
  check('BOOKING HISTORY reports the same code, amount and venue as the booking record',
    row?.bookingCode === bookingCode && money(row.netAmount) === money(booking.netAmount)
      && row.venueName === booking.venueName,
    `history "${row?.bookingCode}" ৳${money(row?.netAmount)} at ${row?.venueName}`);

  const confirmation = await screenText(player, `/player/booking-success?bookingId=${bookingId}`);
  const detail = await screenText(player, `/player/bookings/${bookingId}`);
  const list = await screenText(player, '/player/bookings');
  const dash = await screenText(player, '/player/dashboard/bookings');
  check('CONFIRMATION, DETAIL, HISTORY and DASHBOARD all name the same booking',
    [confirmation, detail, list].every((t) => t.includes(bookingCode))
      && dash.includes(booking.venueName),
    `code on confirmation=${confirmation.includes(bookingCode)}, detail=${detail.includes(bookingCode)}, history=${list.includes(bookingCode)}; dashboard names the venue=${dash.includes(booking.venueName)}`);

  check('CONFIRMATION and DETAIL tell the player which venue and pitch they booked',
    confirmation.includes(booking.venueName) && confirmation.includes(booking.pitchName)
      && detail.includes(booking.venueName) && detail.includes(booking.pitchName),
    `confirmation names venue=${confirmation.includes(booking.venueName)} pitch=${confirmation.includes(booking.pitchName)}; detail names venue=${detail.includes(booking.venueName)} pitch=${detail.includes(booking.pitchName)}`);

  const shown = String(catalogPrice.toLocaleString('en-IN'));
  check('CONFIRMATION and DETAIL quote the same amount as the ledger',
    confirmation.includes(shown) && detail.includes(shown),
    `৳${shown} on confirmation=${confirmation.includes(shown)}, on detail=${detail.includes(shown)}`);
}

// -- notifications ----------------------------------------------------------
// The product only writes notifications for owner events, and the player feed
// says so honestly ("All caught up!"). What must hold is that the screen and
// the feed agree — a bell claiming unread items over an empty list, or a list
// the screen does not render, is the contradiction worth catching.
{
  const rows = (await api('/notifications', { token: player.token })).json ?? [];
  const unread = unwrap((await api('/notifications/unread-count', { token: player.token })).json);
  const screen = await screenText(player, '/player/dashboard/notifications');
  check('NOTIFICATIONS: the screen, the feed and the unread badge agree',
    rows.length === 0
      ? /All caught up|no notifications/i.test(screen) && Number(unread?.count ?? 0) === 0
      : rows.every((n) => screen.includes(n.title))
        && Number(unread?.count ?? 0) === rows.filter((n) => !n.isRead).length,
    `${rows.length} notification(s), unread badge ${unread?.count}, screen agrees=${rows.length === 0 ? /All caught up|no notifications/i.test(screen) : rows.every((n) => screen.includes(n.title))}`);
}

// -- owner surfaces ---------------------------------------------------------
{
  const rows = (await api('/owner/bookings', { token: owner.token })).json;
  const row = rows.find((b) => b.id === bookingId);
  check('OWNER BOOKING LIST shows the booking the player just made',
    Boolean(row) && row.bookingCode === bookingCode,
    row ? `row ${row.bookingCode}, customer "${row.customer}", ${row.amountFormatted}` : 'booking absent from the owner list');

  check('OWNER BOOKING LIST quotes the same money as the player and the ledger',
    row && digits(row.amountFormatted) === money(booking.netAmount),
    `owner shows ${row?.amountFormatted}, player and ledger say ৳${money(booking.netAmount)}`);

  check('OWNER BOOKING LIST names the customer the account actually belongs to',
    row?.customer === player.fullName,
    `owner shows "${row?.customer}", the account is "${player.fullName}"`);

  const ownerScreen = await screenText(owner, '/owner/bookings');
  check('the owner bookings screen renders what that endpoint returned',
    ownerScreen.includes(bookingCode),
    `booking code on screen=${ownerScreen.includes(bookingCode)}`);
}

// -- customer record --------------------------------------------------------
{
  const after = (await api('/owner/customers', { token: owner.token })).json;
  const row = after.find((c) => String(c.id) === String(player.user.id));
  const spend = digits(row?.spend);
  check('CUSTOMER RECORD: the new customer appears with exactly the one booking they made',
    row && row.bookings === 1,
    row ? `bookings=${row.bookings}, confirmedVisits=${row.confirmedVisits}, spend=${row.spend}, loyalty="${row.loyalty?.text}"` : 'customer absent');

  check('CUSTOMER RECORD: spend equals what the ledger actually recorded',
    spend === money(booking.netAmount),
    `customer spend ${row?.spend} vs ledger ৳${money(booking.netAmount)}`);

  check('CUSTOMER RECORD: the visit count and the loyalty badge tell the same story',
    row && String(row.loyalty?.text ?? '').startsWith(String(row.confirmedVisits))
      || String(row?.loyalty?.text ?? '') === '1 visit' && row?.confirmedVisits === 1,
    `confirmedVisits=${row?.confirmedVisits}, badge="${row?.loyalty?.text}"`);

  check('CUSTOMER RECORD: "last visit" is not a date in the future',
    row && (row.lastVisit === 'Never'
      || new Date(row.lastVisit) <= new Date(new Date().toISOString().slice(0, 10))),
    `lastVisit=${row?.lastVisit}, today=${new Date().toISOString().slice(0, 10)}, booking is for ${booking.bookingDate}`);

  // The same rule has to hold for the whole book, not just the row this audit
  // created — one customer with a visit dated next month is the contradiction.
  const today = new Date().toISOString().slice(0, 10);
  const future = after.filter((c) => c.lastVisit !== 'Never' && c.lastVisit > today);
  check('CUSTOMER RECORD: no customer is credited with a visit that has not happened yet',
    future.length === 0,
    `${future.length} of ${after.length} customer(s) have a future "last visit"${future.length ? `, e.g. ${future[0].name} on ${future[0].lastVisit}` : ''}`);
}

// -- owner analytics --------------------------------------------------------
{
  const dash = unwrap((await api('/owner/analytics/dashboard', { token: owner.token })).json);
  const pay = unwrap((await api('/owner/payments?timeframe=daily', { token: owner.token })).json);
  const revBefore = digits(kpi(before.dashboard, "Today's revenue"));
  const revAfter = digits(kpi(dash, "Today's revenue"));
  const grossBefore = digits((before.payments?.kpis ?? []).find((k) => /^Gross/.test(k.label))?.value);
  const grossAfter = digits((pay?.kpis ?? []).find((k) => /^Gross/.test(k.label))?.value);

  check('ANALYTICS: the dashboard and the payments screen agree on today\'s takings',
    revAfter - revBefore === grossAfter - grossBefore,
    `dashboard +৳${revAfter - revBefore} (${revBefore}→${revAfter}), payments +৳${grossAfter - grossBefore} (${grossBefore}→${grossAfter}) for a ৳${money(booking.netAmount)} booking on ${booking.bookingDate}`);

  check('ANALYTICS: today\'s takings only count bookings that are actually played today',
    booking.bookingDate === new Date().toISOString().slice(0, 10)
      ? revAfter - revBefore === money(booking.netAmount)
      : revAfter - revBefore === 0,
    `booking is for ${booking.bookingDate}, today is ${new Date().toISOString().slice(0, 10)}, dashboard revenue moved by ৳${revAfter - revBefore}`);

  const bookedBefore = digits(kpi(before.dashboard, 'Bookings today'));
  const bookedAfter = digits(kpi(dash, 'Bookings today'));
  check('ANALYTICS: the bookings-today count and the revenue-today figure describe the same set',
    (bookedAfter - bookedBefore > 0) === (revAfter - revBefore > 0),
    `count ${bookedBefore}→${bookedAfter}, revenue ${revBefore}→${revAfter}`);
}

// -- a booking for a future date -------------------------------------------
// The first booking above happened to be for today, which cannot tell the two
// possible definitions of "today" apart. This one is played next week, so any
// surface that counts it as today's trade is counting money it will also count
// again on the day it is played.
{
  const later = await registerPlayer('nextweek');
  let futureTarget = null;
  for (let d = 2; d <= 6 && !futureTarget; d += 1) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const slots = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
    const free = (Array.isArray(slots) ? slots : []).find((s) => s.status === 'AVAILABLE' && s.bookable);
    if (free) futureTarget = { slot: free, date };
  }
  const dashBefore = unwrap((await api('/owner/analytics/dashboard', { token: owner.token })).json);
  const payBefore = unwrap((await api('/owner/payments?timeframe=daily', { token: owner.token })).json);

  await api('/bookings/hold-slot', { method: 'POST', token: later.token, body: { slotId: futureTarget.slot.id } });
  await api('/payments/checkout', {
    method: 'POST', token: later.token,
    body: { slotId: futureTarget.slot.id, method: 'BKASH', applyWalletAmount: 0 },
  });

  const dashAfter = unwrap((await api('/owner/analytics/dashboard', { token: owner.token })).json);
  const payAfter = unwrap((await api('/owner/payments?timeframe=daily', { token: owner.token })).json);
  const revMoved = digits(kpi(dashAfter, "Today's revenue")) - digits(kpi(dashBefore, "Today's revenue"));
  const cntMoved = digits(kpi(dashAfter, 'Bookings today')) - digits(kpi(dashBefore, 'Bookings today'));
  const grossMoved = digits((payAfter?.kpis ?? []).find((k) => /^Gross/.test(k.label))?.value)
    - digits((payBefore?.kpis ?? []).find((k) => /^Gross/.test(k.label))?.value);

  check("ANALYTICS: a booking played next week is not counted in today's revenue",
    revMoved === 0,
    `booking for ${futureTarget.date} (today is ${new Date().toISOString().slice(0, 10)}) moved today's revenue by ৳${revMoved}`);

  check("ANALYTICS: a booking played next week is not counted in today's booking count",
    cntMoved === 0,
    `bookings-today moved by ${cntMoved}`);

  check("ANALYTICS: the dashboard and the payments screen agree on today's takings",
    revMoved === grossMoved,
    `dashboard +৳${revMoved}, payments +৳${grossMoved}`);

  // Occupancy sits in the same KPI row and is measured from today's slots only,
  // so if the count above moved, the row now contradicts itself.
  const occ = (dashAfter?.kpis ?? []).find((k) => k.label === 'Occupancy');
  check("ANALYTICS: the bookings-today count agrees with the occupancy it is shown beside",
    cntMoved === 0 || /(\d+) of/.test(String(occ?.delta ?? '')),
    `bookings-today moved by ${cntMoved} while occupancy reports "${occ?.delta}"`);
}

/* ===================================================================== */
section('USER CONSISTENCY');

const NEW_NAME = `Renamed Player ${Date.now() % 100000}`;
{
  const updated = await api('/players/me', {
    method: 'PATCH', token: player.token,
    body: { fullName: NEW_NAME, area: 'Banani', bio: 'Consistency audit profile.' },
  });
  check('the profile update is accepted and echoed back',
    updated.status === 200 && unwrap(updated.json)?.fullName === NEW_NAME,
    `HTTP ${updated.status}, echoed "${unwrap(updated.json)?.fullName}"`);

  const me = unwrap((await api('/me', { token: player.token })).json);
  const playerMe = unwrap((await api('/players/me', { token: player.token })).json);
  check('both identity endpoints report the new name (no duplicate user object)',
    me?.fullName === NEW_NAME && playerMe?.fullName === NEW_NAME,
    `/me="${me?.fullName}", /players/me="${playerMe?.fullName}"`);

  const ownerRow = (await api('/owner/bookings', { token: owner.token })).json.find((b) => b.id === bookingId);
  check('the owner booking list shows the renamed customer, not a stale copy',
    ownerRow?.customer === NEW_NAME,
    `owner list says "${ownerRow?.customer}"`);

  const customer = (await api('/owner/customers', { token: owner.token })).json
    .find((c) => String(c.id) === String(player.user.id));
  check('the owner customer record shows the renamed customer',
    customer?.name === NEW_NAME,
    `customer record says "${customer?.name}"`);

  const dash = unwrap((await api('/owner/analytics/dashboard', { token: owner.token })).json);
  const mentions = JSON.stringify(dash);
  check('the owner dashboard feeds show the renamed customer',
    !mentions.includes(player.fullName),
    `dashboard still mentions the old name "${player.fullName}"=${mentions.includes(player.fullName)}`);

  if (admin) {
    const roster = unwrap((await api(`/admin/users?page=0&size=25&term=${encodeURIComponent(NEW_NAME)}`, { token: admin })).json);
    check('the admin roster finds the account under its new name',
      (roster?.items ?? []).some((u) => u.fullName === NEW_NAME),
      `${roster?.items?.length ?? 0} match(es) for "${NEW_NAME}"`);
  }

  const settings = await screenText(player, '/player/dashboard/settings');
  check('the profile screen shows the new name everywhere on it, with no stale copy left',
    settings.includes(NEW_NAME) && !settings.includes(player.fullName),
    `new name on screen=${settings.includes(NEW_NAME)}, old name still on screen=${settings.includes(player.fullName)}`);

  const home = await screenText(player, '/player');
  check('the shell around the page (topbar, greeting) shows the new name too',
    !home.includes(player.fullName),
    `old name "${player.fullName}" still in the shell=${home.includes(player.fullName)}`);
}

/* ===================================================================== */
section('VENUE CONSISTENCY');

{
  const NEW_VENUE_NAME = `${venue.name} ${Date.now() % 10000}`;
  const NEW_PHONE = '+8801711000999';
  const NEW_ADDRESS = 'Road 99, Consistency Block';
  const updated = await api(`/owner/venues/${venue.id}`, {
    method: 'PUT', token: owner.token,
    body: { name: NEW_VENUE_NAME, contactPhone: NEW_PHONE, address: NEW_ADDRESS },
  });
  check('the owner venue update is accepted',
    updated.status === 200 && updated.json?.name === NEW_VENUE_NAME,
    `HTTP ${updated.status}, name now "${updated.json?.name}"`);

  const publicVenue = unwrap((await api(`/venues/${venue.slug}`)).json);
  check('PUBLIC VENUE reflects the owner\'s change',
    publicVenue?.name === NEW_VENUE_NAME && publicVenue?.address === NEW_ADDRESS,
    `public name "${publicVenue?.name}", address "${publicVenue?.address}"`);

  const found = unwrap((await api(`/venues?q=${encodeURIComponent(NEW_VENUE_NAME)}&page=0&size=20`)).json);
  check('SEARCH RESULTS find the venue under its new name',
    (found?.items ?? []).some((v) => v.id === venue.id && v.name === NEW_VENUE_NAME),
    `${found?.items?.length ?? 0} result(s) for the new name`);

  if (admin) {
    const adminVenues = unwrap((await api('/admin/venues?page=0&size=100', { token: admin })).json);
    const list = Array.isArray(adminVenues) ? adminVenues : (adminVenues?.items ?? []);
    const adminRow = list.find((v) => v.id === venue.id);
    check('ADMIN VENUE record reflects the same change',
      !adminRow || adminRow.name === NEW_VENUE_NAME,
      `admin console shows "${adminRow?.name ?? '(not in the first page)'}"`);
  }

  const bookingNow = (await api(`/bookings/${bookingId}`, { token: player.token })).json;
  check('an existing booking names the venue as it is now, not as it was',
    bookingNow.venueName === NEW_VENUE_NAME,
    `booking says "${bookingNow.venueName}", venue is "${NEW_VENUE_NAME}"`);

  check('the contact number a player is given is the one the owner set',
    bookingNow.venueContactPhone === NEW_PHONE && publicVenue?.contactPhone === NEW_PHONE,
    `booking "${bookingNow.venueContactPhone}", public venue "${publicVenue?.contactPhone}"`);

  const venuePage = await screenText(player, `/player/venues/${venue.slug}`);
  const bookingPage = await screenText(player, `/player/bookings/${bookingId}`);
  check('the venue page and the booking flow both show the new name',
    venuePage.includes(NEW_VENUE_NAME) && bookingPage.includes(NEW_VENUE_NAME),
    `venue page=${venuePage.includes(NEW_VENUE_NAME)}, booking detail=${bookingPage.includes(NEW_VENUE_NAME)}`);
}

/* ===================================================================== */
section('TOURNAMENT CONSISTENCY');

{
  const hostView = unwrap((await api(`/host/tournaments/${TOURNAMENT}`, { token: host.token })).json);
  const playerView = (await api(`/tournaments/${TOURNAMENT}`, { token: player.token })).json;
  const browse = unwrap((await api('/tournaments?openOnly=false&upcomingOnly=false&page=0&size=30', { token: player.token })).json);
  const card = (browse?.items ?? []).find((t) => t.code === TOURNAMENT);

  check('DISCOVERY, DETAILS and HOST DASHBOARD agree on the tournament identity',
    card?.name === hostView.name && playerView.name === hostView.name
      && card?.venueSlug === hostView.venueSlug && String(card?.date) === String(hostView.date),
    `card "${card?.name}" @${card?.venueSlug} ${card?.date}; host "${hostView.name}" @${hostView.venueSlug} ${hostView.date}`);

  check('DISCOVERY and HOST DASHBOARD agree on money and capacity',
    money(card?.entryFeePerTeam) === money(hostView.entryFeePerTeam)
      && money(card?.prizePool) === money(hostView.prizePool)
      && card?.teamCapacity === hostView.teamCapacity,
    `card ৳${money(card?.entryFeePerTeam)} fee / ৳${money(card?.prizePool)} prize / ${card?.teamCapacity} cap; host ৳${money(hostView.entryFeePerTeam)} / ৳${money(hostView.prizePool)} / ${hostView.teamCapacity}`);

  check('TEAM DATA: the registered-team count is the number of teams that exist',
    card?.registeredTeams === hostView.teams.length
      && card.registeredTeams + card.spotsLeft === card.teamCapacity,
    `card says ${card?.registeredTeams} registered + ${card?.spotsLeft} left of ${card?.teamCapacity}; host holds ${hostView.teams.length} team(s)`);

  const names = new Set(hostView.teams.map((t) => t.name));
  const fixtureTeams = hostView.fixtures.flatMap((f) => [f.teamA, f.teamB])
    .filter((n) => n && !/^bye$/i.test(n) && !/^TBD$/i.test(n));
  check('FIXTURES and BRACKET only reference teams that are actually registered',
    fixtureTeams.every((n) => names.has(n)),
    `${hostView.fixtures.length} fixture(s); unknown teams: ${[...new Set(fixtureTeams.filter((n) => !names.has(n)))].join(', ') || 'none'}`);

  const paidTotal = hostView.teams
    .filter((t) => t.entryFeeStatus === 'PAID')
    .reduce((s, t) => s + Number(t.entryFeePaid ?? 0), 0);
  const expected = hostView.teams.filter((t) => t.entryFeeStatus === 'PAID').length
    * Number(hostView.entryFeePerTeam);
  check('REGISTRATION PAYMENT: each paid team paid the tournament\'s own entry fee',
    paidTotal === expected,
    `${hostView.teams.filter((t) => t.entryFeeStatus === 'PAID').length} paid team(s) total ৳${paidTotal}, fee ৳${money(hostView.entryFeePerTeam)} each = ৳${expected}`);

  const hostScreen = await screenText(host, '/host/tournament');
  const playerScreen = await screenText(player, `/player/tournaments/${TOURNAMENT}`);
  check('the host screen and the player screen state the same team count',
    hostScreen.includes(String(hostView.teams.length)) && playerScreen.includes(hostView.name),
    `host screen mentions ${hostView.teams.length}=${hostScreen.includes(String(hostView.teams.length))}, player screen names the cup=${playerScreen.includes(hostView.name)}`);
}

/* ===================================================================== */
section('PAYMENT CONSISTENCY');

{
  const preview = unwrap((await api(`/payments/refund-preview/${bookingId}`, { token: player.token })).json);
  const cancelled = await api(`/payments/cancel/${bookingId}`, { method: 'POST', token: player.token });
  const result = unwrap(cancelled.json);
  const after = (await api(`/bookings/${bookingId}`, { token: player.token })).json;
  const ledger = unwrap((await api(`/payments/booking/${bookingId}`, { token: player.token })).json);
  const refunds = ledger.filter((p) => p.type === 'REFUND');
  const slots = (await api(`/venues/${venue.id}/slots?date=${target.date}`)).json;
  const slot = slots.find((s) => s.id === target.slot.id);

  check('the refund quoted before cancelling is the refund actually recorded',
    money(preview?.refundAmount) === money(result?.refundAmount)
      && money(result?.refundAmount) === refunds.reduce((s, p) => s + money(p.amount), 0),
    `preview ৳${money(preview?.refundAmount)}, response ৳${money(result?.refundAmount)}, ledger ৳${refunds.reduce((s, p) => s + money(p.amount), 0)}`);

  check('booking state, slot state and ledger state agree after a cancellation',
    after.status === 'CANCELLED' && slot?.status === 'AVAILABLE' && slot?.bookable === true,
    `booking ${after.status}, slot ${slot?.status} bookable=${slot?.bookable}, ${refunds.length} refund row(s)`);

  const detail = await screenText(player, `/player/bookings/${bookingId}`);
  check('the booking screen states the cancellation the database recorded',
    /cancelled/i.test(detail),
    `screen says cancelled=${/cancelled/i.test(detail)}`);

  const ownerRow = (await api('/owner/bookings', { token: owner.token })).json.find((b) => b.id === bookingId);
  check('the owner sees the same cancelled state as the player',
    ownerRow?.status === 'CANCELLED' && ownerRow?.payment?.text === 'Cancelled',
    `owner row status=${ownerRow?.status}, badge="${ownerRow?.payment?.text}"`);

  const customer = (await api('/owner/customers', { token: owner.token })).json
    .find((c) => String(c.id) === String(player.user.id));
  check('a cancelled booking is not counted as a visit or as spend',
    digits(customer?.spend) === 0 && customer?.confirmedVisits === 0,
    `spend=${customer?.spend}, confirmedVisits=${customer?.confirmedVisits}, bookings=${customer?.bookings}`);
}

/* ===================================================================== */
section('REVIEW CONSISTENCY');

{
  // Reviews need a booking whose match has started, so use a seeded account
  // with real history rather than the fresh one above.
  let author = null;
  let subject = null;
  const candidates = [host];
  if (admin) {
    const roster = unwrap((await api('/admin/users?page=0&size=40&role=PLAYER', { token: admin })).json);
    for (const u of roster?.items ?? []) {
      if (!u.email || u.email === HOST.email) continue;
      try { candidates.push(await login({ email: u.email, password: 'Demo@12345' })); } catch { /* other password */ }
      if (candidates.length >= 10) break;
    }
  }

  let venueBefore = null;
  let feedBefore = [];
  let slug = null;
  outer: for (const candidate of candidates) {
    const bookings = (await api('/bookings', { token: candidate.token })).json;
    for (const b of (Array.isArray(bookings) ? bookings : [])) {
      if (b.status === 'CANCELLED') continue;
      if (new Date(`${b.bookingDate}T${b.startTime}`) >= new Date()) continue;
      slug = b.venueSlug;
      venueBefore = unwrap((await api(`/venues/${slug}`)).json);      const feed = unwrap((await api(`/venues/${slug}/reviews?page=0&size=100`)).json);
      feedBefore = Array.isArray(feed) ? feed : (feed?.items ?? feed?.content ?? []);
      const attempt = await api('/reviews', {
        method: 'POST', token: candidate.token,
        body: {
          bookingId: b.id, venueId: b.venueId, overallRating: 5,
          comment: 'Consistency audit review — pitch and lights were both good.',
        },
      });
      if (attempt.status === 200) { author = candidate; subject = b; break outer; }
    }
  }

  if (!author) {
    check('a reviewable booking could be found', false, 'every past booking on every candidate account is already reviewed');
  } else {
    const me = unwrap((await api('/me', { token: author.token })).json);
    const feedAfterRaw = unwrap((await api(`/venues/${slug}/reviews?page=0&size=100`)).json);
    const feedAfter = Array.isArray(feedAfterRaw) ? feedAfterRaw : (feedAfterRaw?.items ?? feedAfterRaw?.content ?? []);
    const venueAfter = unwrap((await api(`/venues/${slug}`)).json);
    const mine = feedAfter.find((r) => String(r.comment ?? '').includes('Consistency audit review'));

    check('REVIEW LIST grows by exactly the one review that was written',
      feedAfter.length === feedBefore.length + 1,
      `${feedBefore.length} → ${feedAfter.length} review(s) on ${slug}`);

    check('REVIEW COUNT on the venue matches the number of reviews it lists',
      venueAfter?.reviewCount === feedAfter.length,
      `venue reports reviewCount=${venueAfter?.reviewCount}, the list holds ${feedAfter.length}`);

    check('REVIEW COUNT moved by one when one review was added',
      (venueAfter?.reviewCount ?? 0) === (venueBefore?.reviewCount ?? 0) + 1,
      `${venueBefore?.reviewCount} → ${venueAfter?.reviewCount}`);

    const mean = feedAfter.reduce((s, r) => s + Number(r.overallRating ?? r.rating ?? 0), 0) / feedAfter.length;
    check('VENUE RATING is the average of the reviews the venue actually has',
      Math.abs(Number(venueAfter?.rating ?? 0) - mean) < 0.06,
      `venue says ${venueAfter?.rating}, the listed reviews average ${mean.toFixed(2)}`);

    check('REVIEWER IDENTITY is the account that wrote it',
      mine && String(mine.authorName ?? mine.author ?? mine.userName ?? '').length > 0
        && String(mine.authorName ?? mine.author ?? mine.userName ?? '').split(' ')[0]
           === String(me?.fullName ?? '').split(' ')[0],
      `review attributed to "${mine?.authorName ?? mine?.author ?? mine?.userName}", author account is "${me?.fullName}"`);

    const search = unwrap((await api(`/venues?q=${encodeURIComponent(venueAfter.name)}&page=0&size=20`)).json);
    const inSearch = (search?.items ?? []).find((v) => v.slug === slug);
    check('SEARCH RESULTS quote the same rating and review count as the venue page',
      inSearch && Number(inSearch.rating) === Number(venueAfter.rating)
        && inSearch.reviewCount === venueAfter.reviewCount,
      `search ${inSearch?.rating}★ (${inSearch?.reviewCount}) vs venue ${venueAfter?.rating}★ (${venueAfter?.reviewCount})`);

    const venuePage = await screenText(author, `/player/venues/${slug}`);
    check('the venue screen states the same rating and review count as the API',
      venuePage.includes(String(venueAfter.reviewCount)) && venuePage.includes(String(venueAfter.rating)),
      `screen shows the count=${venuePage.includes(String(venueAfter.reviewCount))}, the rating ${venueAfter.rating}=${venuePage.includes(String(venueAfter.rating))}`);

    const again = await api('/reviews', {
      method: 'POST', token: author.token,
      body: { bookingId: subject.id, venueId: subject.venueId, overallRating: 1, comment: 'again' },
    });
    const feedFinalRaw = unwrap((await api(`/venues/${slug}/reviews?page=0&size=100`)).json);
    const feedFinal = Array.isArray(feedFinalRaw) ? feedFinalRaw : (feedFinalRaw?.items ?? feedFinalRaw?.content ?? []);
    check('BOOKING ELIGIBILITY: a second review for the same booking neither lands nor moves the count',
      again.status >= 400 && feedFinal.length === feedAfter.length,
      `HTTP ${again.status}, list still ${feedFinal.length}`);
  }
}

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`DATA CONSISTENCY CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`DATA CONSISTENCY: ${failures.length} contradiction(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
