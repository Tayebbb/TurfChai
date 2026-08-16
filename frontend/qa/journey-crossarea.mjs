// Cross-area journeys: tournament registration (player side), reviews, and
// promotions.
//
// The point of every block here is the same: a thing done in one part of the
// product has to become true in the other parts that talk about it, and the
// state machine behind it must refuse the transitions that are not legitimate.
//
//   node qa/journey-crossarea.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';
const HOST = { email: 'rafi@turfchai.dev', password: 'demo1234' };
const OWNER = { email: 'brishty.ahmed.285@gmail.com', password: 'Demo@12345' };
const CODE = 'TR-CUP-0091';

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

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}
async function registerPlayer(tag) {
  const email = `crossarea.${tag}.${Date.now()}@example.com`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: `Crossarea ${tag}`, email, password: 'Demo@12345',
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  return { ...(await login({ email, password: 'Demo@12345' })), email };
}

const host = await login(HOST);
const owner = await login(OWNER);
const player = await registerPlayer('entrant');

/**
 * Admin sign-in is 2FA and rate-limited per account, so reuse a token the gate
 * already minted when there is one and only fall back to a fresh challenge.
 * Used here purely to read the player roster.
 */
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
async function pageAs(session, path) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([t, u]) => {
    try {
      localStorage.setItem('turfchai.auth.token', t);
      localStorage.setItem('turfchai.auth.user', u);
    } catch { /* about:blank */ }
  }, [session.token, JSON.stringify(session.user ?? {})]);
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForTimeout(3500);
  return { ctx, page, text: await page.evaluate(() => document.body.innerText) };
}

const registration = (teamName) => ({
  teamName,
  captainName: 'Crossarea Captain',
  contactPhone: '+8801700000001',
  emergencyContact: 'Next of kin +8801700000002',
  jerseyNumber: '10',
  skillLevel: 'INTERMEDIATE',
  medicalNotes: 'none',
  agreedToRules: true,
});

/* ========================= TOURNAMENT — PLAYER SIDE ====================== */
console.log('\n============ TOURNAMENT JOURNEY (PLAYER SIDE) ============\n');

// -- discover ---------------------------------------------------------------
{
  const browse = unwrap((await api('/tournaments?openOnly=false&upcomingOnly=false&page=0&size=20', { token: player.token })).json);
  const items = browse?.items ?? [];
  const card = items.find((t) => t.code === CODE);
  check('a player can discover the tournament and the card states its real capacity',
    Boolean(card) && card.registeredTeams + card.spotsLeft === card.teamCapacity,
    card
      ? `${card.name}: ${card.registeredTeams} registered + ${card.spotsLeft} left = ${card.teamCapacity} capacity`
      : `tournament ${CODE} absent from ${items.length} browse result(s)`);
}

// -- rules must be accepted -------------------------------------------------
{
  const refused = await api(`/tournaments/${CODE}/register`, {
    method: 'POST', token: player.token,
    body: { ...registration('No Consent FC'), agreedToRules: false },
  });
  check('REGISTRATION: registering without accepting the rules is refused',
    refused.status === 400,
    `HTTP ${refused.status}`);
}

// -- register ---------------------------------------------------------------
const teamName = `Crossarea United ${Date.now() % 100000}`;
{
  const before = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json).teams.length;
  const created = await api(`/tournaments/${CODE}/register`, {
    method: 'POST', token: player.token, body: registration(teamName),
  });
  const after = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json).teams;
  check('REGISTRATION none -> registered, and the entry fee starts DUE',
    created.status === 201 && created.json?.entryFeeStatus === 'DUE'
      && Boolean(created.json?.registrationCode) && after.length === before + 1,
    `HTTP ${created.status}, status=${created.json?.entryFeeStatus}, code=${created.json?.registrationCode}, teams ${before} -> ${after.length}`);

  check("the host's team list carries the player's own team, not a placeholder",
    after.some((t) => t.name === teamName),
    `host workspace lists "${teamName}"=${after.some((t) => t.name === teamName)}`);
}

// -- the same player cannot register twice ----------------------------------
{
  const dupe = await api(`/tournaments/${CODE}/register`, {
    method: 'POST', token: player.token, body: registration(`${teamName} B`),
  });
  check('REGISTRATION registered -> registered is refused',
    dupe.status === 409,
    `second registration answered ${dupe.status}`);
}

// -- the player sees the fixtures and the bracket ---------------------------
{
  const view = (await api(`/tournaments/${CODE}`, { token: player.token })).json;
  const { ctx, text } = await pageAs(player, `/player/tournaments/${CODE}`);
  const fixture = view?.fixtures?.[0];
  check('the player screen shows the tournament and the same fixtures the API holds',
    text.includes(view.name) && (view.fixtures?.length ?? 0) > 0
      && (text.includes(fixture.teamA) || text.includes(fixture.roundLabel)),
    `screen names "${view.name}", API has ${view.fixtures?.length} fixture(s), first round "${fixture?.roundLabel}" rendered=${text.includes(fixture?.roundLabel ?? '~')}`);
  await ctx.close();
}

// -- withdraw while the fee is still DUE ------------------------------------
{
  const before = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json).teams.length;
  const gone = await api(`/tournaments/${CODE}/register`, { method: 'DELETE', token: player.token });
  const after = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json).teams;
  const mine = (await api('/tournaments/me', { token: player.token })).json;
  check('REGISTRATION registered -> withdrawn removes the team everywhere',
    gone.status === 204 && after.length === before - 1
      && !after.some((t) => t.name === teamName)
      && !(Array.isArray(mine) ? mine : []).some((t) => t.code === CODE),
    `HTTP ${gone.status}, host teams ${before} -> ${after.length}, still on host list=${after.some((t) => t.name === teamName)}, still on my list=${(Array.isArray(mine) ? mine : []).some((t) => t.code === CODE)}`);
}

// -- withdrawing twice ------------------------------------------------------
{
  const again = await api(`/tournaments/${CODE}/register`, { method: 'DELETE', token: player.token });
  check('REGISTRATION withdrawn -> withdrawn is refused',
    again.status >= 400,
    `second withdrawal answered ${again.status}`);
}

// -- entry fee DUE -> PAID, and a paid entry can no longer just walk away ---
{
  const payer = await registerPlayer('payer');
  const paidTeamName = `Crossarea Rovers ${Date.now() % 100000}`;
  const entry = await api(`/tournaments/${CODE}/register`, {
    method: 'POST', token: payer.token, body: registration(paidTeamName),
  });
  const paid = await api(`/host/tournaments/${CODE}/teams/${entry.json?.id}/entry-fee`, {
    method: 'POST', token: host.token,
  });
  const mine = (await api('/tournaments/me', { token: payer.token })).json;
  const card = (Array.isArray(mine) ? mine : []).find((t) => t.code === CODE);
  check('ENTRY FEE DUE -> PAID, and both sides report the same payment state',
    paid.status === 200 && paid.json?.entryFeeStatus === 'PAID'
      && card?.myPaymentStatus === 'PAID' && Number(paid.json?.entryFeePaid) > 0,
    `host says ${paid.json?.entryFeeStatus} ৳${paid.json?.entryFeePaid}, player says ${card?.myPaymentStatus}`);

  const blocked = await api(`/tournaments/${CODE}/register`, { method: 'DELETE', token: payer.token });
  const still = unwrap((await api(`/host/tournaments/${CODE}`, { token: host.token })).json).teams;
  check('REGISTRATION paid -> withdrawn is refused, and the team stays registered',
    blocked.status === 409 && still.some((t) => t.name === paidTeamName),
    `HTTP ${blocked.status}, team still on the host list=${still.some((t) => t.name === paidTeamName)}`);
}

/* ================================= REVIEWS ============================== */
console.log('\n===================== REVIEW JOURNEY =====================\n');

{
  // The seeder wrote a review for most completed bookings, so hunt across the
  // real player roster for one that is genuinely un-reviewed rather than
  // asserting against whichever account happens to be to hand.
  const candidates = [{ session: host, label: HOST.email }];
  const adminJwt = await adminToken();
  if (adminJwt) {
    const roster = unwrap((await api('/admin/users?page=0&size=60&role=PLAYER', { token: adminJwt })).json);
    for (const u of roster?.items ?? []) {
      if (!u.email || u.email === HOST.email) continue;
      try { candidates.push({ session: await login({ email: u.email, password: 'Demo@12345' }), label: u.email }); }
      catch { /* seeded account with a different password */ }
      if (candidates.length >= 12) break;
    }
  }

  let created = null;
  let target = null;
  let author = null;
  let scanned = 0;
  outer: for (const candidate of candidates) {
    const bookings = (await api('/bookings', { token: candidate.session.token })).json;
    const played = (Array.isArray(bookings) ? bookings : []).filter(
      (b) => b.status !== 'CANCELLED' && new Date(`${b.bookingDate}T${b.startTime}`) < new Date(),
    );
    scanned += played.length;
    for (const booking of played) {
      const attempt = await api('/reviews', {
        method: 'POST', token: candidate.session.token,
        body: {
          bookingId: booking.id, venueId: booking.venueId, overallRating: 5,
          comment: 'Cross-area journey review — surface and lighting were both good.',
          subRatings: { surface: 5, lighting: 4, cleanliness: 5 },
        },
      });
      if (attempt.status === 200) { created = attempt; target = booking; author = candidate.session; break outer; }
    }
  }

  check('REVIEW none -> published for a booking the player actually played',
    Boolean(created) && unwrap(created.json)?.overallRating === 5,
    created
      ? `booking ${target.bookingCode} reviewed, rating ${unwrap(created.json)?.overallRating}`
      : `no un-reviewed past booking among ${scanned} candidate(s) across ${candidates.length} account(s)`);

  if (created) {
    let slug = null;
    for (let p = 0; p < 3 && !slug; p += 1) {
      const page = unwrap((await api(`/venues?page=${p}&size=50`)).json);
      slug = (page?.items ?? []).find((v) => v.id === target.venueId)?.slug ?? null;
    }
    const feed = unwrap((await api(`/venues/${slug}/reviews`)).json);
    const rows = Array.isArray(feed) ? feed : (feed?.items ?? feed?.content ?? []);
    const onFeed = rows.some((r) => String(r.comment ?? '').includes('Cross-area journey review'));
    check('the new review appears on the public venue page it was written about',
      onFeed,
      `${rows.length} public review(s) on ${slug}, journey review present=${onFeed}`);

    const { ctx, text } = await pageAs(author, `/player/venues/${slug}`);
    check('the venue screen shows the review the API just published',
      text.includes('Cross-area journey review'),
      `venue page renders the review text=${text.includes('Cross-area journey review')}`);
    await ctx.close();

    const dupe = await api('/reviews', {
      method: 'POST', token: author.token,
      body: { bookingId: target.id, venueId: target.venueId, overallRating: 1, comment: 'again' },
    });
    check('REVIEW published -> published is refused for the same booking',
      dupe.status >= 400,
      `second review answered ${dupe.status}`);

    const notMine = await api('/reviews', {
      method: 'POST', token: player.token,
      body: { bookingId: target.id, venueId: target.venueId, overallRating: 1, comment: 'not mine' },
    });
    check("a player cannot review somebody else's booking",
      notMine.status >= 400,
      `HTTP ${notMine.status}`);
  }

  const hostBookings = (await api('/bookings', { token: host.token })).json;
  const future = (Array.isArray(hostBookings) ? hostBookings : []).find(
    (b) => b.status === 'CONFIRMED' && new Date(`${b.bookingDate}T${b.startTime}`) > new Date(),
  );
  if (future) {
    const early = await api('/reviews', {
      method: 'POST', token: host.token,
      body: { bookingId: future.id, venueId: future.venueId, overallRating: 5, comment: 'too early' },
    });
    check('REVIEW cannot be written before the match has started',
      early.status >= 400,
      `booking ${future.bookingCode} on ${future.bookingDate} answered ${early.status}`);
  }
}

/* =============================== PROMOTIONS ============================= */
console.log('\n=================== PROMOTION JOURNEY ====================\n');

{
  const venues = await api('/owner/venues', { token: owner.token });
  const venue = (Array.isArray(venues.json) ? venues.json : [])[0];
  const code = `JOURNEY${Date.now() % 100000}`;

  const promo = await api(`/owner/venues/${venue.id}/promotions`, {
    method: 'POST', token: owner.token,
    body: {
      code, label: 'Cross-area journey promo', discountType: 'PERCENT',
      discountValue: 20, minOrderAmount: 500, maxDiscountAmount: 400,
    },
  });
  check('PROMOTION none -> active is created against the owner\'s own venue',
    promo.status === 201 && promo.json?.code === code && promo.json?.active === true,
    `HTTP ${promo.status}, code ${promo.json?.code}, active=${promo.json?.active}`);

  const applied = await api('/promotions/validate-code', {
    method: 'POST', body: { code, orderTotal: 1500, venueId: venue.id },
  });
  check('the promotion a player types at checkout discounts by the amount the owner set',
    applied.status === 200 && applied.json?.valid === true
      && Number(applied.json?.discountAmount) === 300
      && Number(applied.json?.finalTotal) === 1200,
    `৳1500 -> discount ৳${applied.json?.discountAmount}, final ৳${applied.json?.finalTotal}`);

  const capped = await api('/promotions/validate-code', {
    method: 'POST', body: { code, orderTotal: 5000, venueId: venue.id },
  });
  check('the maximum discount the owner set is actually enforced',
    Number(capped.json?.discountAmount) === 400,
    `20% of ৳5000 would be ৳1000, capped at ৳${capped.json?.discountAmount}`);

  const belowMin = await api('/promotions/validate-code', {
    method: 'POST', body: { code, orderTotal: 100, venueId: venue.id },
  });
  check('an order below the minimum the owner set does not get the discount',
    belowMin.json?.valid === false && /[Mm]inimum/.test(belowMin.json?.reason ?? belowMin.json?.message ?? ''),
    `HTTP ${belowMin.status}, valid=${belowMin.json?.valid}, "${belowMin.json?.reason ?? belowMin.json?.message}"`);

  const wrongVenue = await api('/promotions/validate-code', {
    method: 'POST', body: { code, orderTotal: 1500, venueId: venue.id + 1 },
  });
  check("a venue's promotion does not work at a different venue",
    wrongVenue.json?.valid === false,
    `valid=${wrongVenue.json?.valid}, "${wrongVenue.json?.reason ?? wrongVenue.json?.message}"`);

  const off = await api(`/owner/venues/${venue.id}/promotions/${promo.json?.id}`, {
    method: 'PATCH', token: owner.token, body: { active: false },
  });
  const afterOff = await api('/promotions/validate-code', {
    method: 'POST', body: { code, orderTotal: 1500, venueId: venue.id },
  });
  check('PROMOTION active -> inactive stops the code working at checkout immediately',
    off.status === 200 && off.json?.active === false && afterOff.json?.valid === false,
    `deactivate HTTP ${off.status}, checkout now valid=${afterOff.json?.valid}`);

  const otherOwner = await login({ email: 'shakil.ahmed.286@gmail.com', password: 'Demo@12345' });
  const stolen = await api(`/owner/venues/${venue.id}/promotions`, {
    method: 'GET', token: otherOwner.token,
  });
  check("another owner cannot read this venue's promotions",
    stolen.status >= 400,
    `HTTP ${stolen.status}`);

  await api(`/owner/venues/${venue.id}/promotions/${promo.json?.id}`, {
    method: 'DELETE', token: owner.token,
  });
}

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`CROSS-AREA JOURNEYS CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`CROSS-AREA JOURNEYS: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step} :: ${f.evidence}`);
process.exit(1);
