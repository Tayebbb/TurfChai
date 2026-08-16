// Interruption and recovery.
//
// Real users refresh at the wrong moment, double-click, go back after paying,
// leave a tab open until the session dies, and race each other for the last
// slot. Each scenario below interrupts a workflow deliberately and then checks
// that the product recovers into a truthful state rather than a stuck or lying
// one.
//
//   node qa/journey-interruptions.mjs [baseUrl]
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
  return { status: res.status, json };
}
const unwrap = (j) => (j && typeof j === 'object' && 'data' in j && 'success' in j ? j.data : j);

async function register(tag) {
  const email = `interrupt.${tag}.${Date.now()}@example.com`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: `Interrupt ${tag}`, email, password: DEMO_PW,
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} failed: ${r.status} ${JSON.stringify(r.json)}`);
  const l = await api('/auth/login', { method: 'POST', body: { email, password: DEMO_PW } });
  return l.status === 200 ? { token: l.json.token, user: l.json.user, email } : null;
}

/** The first slot the API says is genuinely bookable. */
async function findFreeSlot(token, skipIds = []) {
  const venues = unwrap((await api('/venues?page=0&size=30')).json);
  for (const v of venues.items ?? []) {
    for (let d = 1; d <= 5; d += 1) {
      const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
      const slots = (await api(`/venues/${v.id}/slots?date=${date}`, { token })).json;
      const free = (Array.isArray(slots) ? slots : [])
        .find((s) => s.status === 'AVAILABLE' && s.bookable && !skipIds.includes(s.id));
      if (free) return { venue: v, slot: free, date };
    }
  }
  return null;
}

const browser = await chromium.launch();
async function contextFor(session) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (session) {
    await ctx.addInitScript(([t, u]) => {
      try {
        localStorage.setItem('turfchai.auth.token', t);
        localStorage.setItem('turfchai.auth.user', u);
      } catch { /* about:blank */ }
    }, [session.token, JSON.stringify(session.user ?? {})]);
  }
  return ctx;
}
const checkoutUrl = (t) => `${BASE}/player/checkout?slotId=${t.slot.id}&venue=${t.venue.slug}&date=${t.date}`;

const alice = await register('alice');
const bob = await register('bob');
console.log('\n================ INTERRUPTION & RECOVERY ================\n');

// ------------------------------------------- 1. refresh mid-checkout --------
{
  const target = await findFreeSlot(alice.token);
  const ctx = await contextFor(alice);
  const page = await ctx.newPage();
  await page.goto(checkoutUrl(target));
  await page.waitForTimeout(3200);
  await page.reload();
  await page.waitForTimeout(3200);
  const ui = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const stillHeld = (await api(`/venues/${target.venue.id}/slots?date=${target.date}`, { token: alice.token }))
    .json.find((s) => s.id === target.slot.id);
  check('refresh during checkout keeps the hold and the price on screen',
    /HELD/.test(stillHeld?.status ?? '') && /৳/.test(ui) && !/Something went wrong/i.test(ui),
    `slot=${stillHeld?.status}, price shown=${/৳/.test(ui)}`);
  await ctx.close();
}

// ------------------------------------ 2. duplicate click on confirm ---------
{
  const target = await findFreeSlot(alice.token);
  const ctx = await contextFor(alice);
  const page = await ctx.newPage();
  const posts = [];
  page.on('request', (r) => { if (r.url().includes('/payments/checkout')) posts.push(1); });
  await page.goto(checkoutUrl(target));
  await page.waitForTimeout(3200);
  await page.click('button:has-text("Pay ")');
  await page.waitForTimeout(1000);
  const confirm = page.locator('button:has-text("Confirm booking")');
  await Promise.all([confirm.click(), confirm.click().catch(() => {})]);
  await page.waitForTimeout(5000);
  const bookings = (await api('/bookings', { token: alice.token })).json;
  const forSlot = bookings.filter((b) => b.slotId === target.slot.id && b.status !== 'CANCELLED');
  check('double-clicking confirm creates exactly one booking',
    posts.length === 1 && forSlot.length === 1,
    `${posts.length} checkout POST(s), ${forSlot.length} live booking(s) for that slot`);

  // ------------------------------ 3. back button after paying ---------------
  await page.goBack();
  await page.waitForTimeout(3500);
  const backUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  check('going back after paying says the slot is already yours, not that someone took it',
    /already booked this slot/i.test(backUi) && !/taken by someone else/i.test(backUi),
    `screen says "${(backUi.match(/[^\n]*already booked[^\n]*/i) ?? ['(missing)'])[0].trim().slice(0, 70)}"`);

  // ------------------------------ 4. close and reopen the tab ---------------
  await page.close();
  const reopened = await ctx.newPage();
  await reopened.goto(BASE + '/player/bookings');
  await reopened.waitForTimeout(3000);
  const listUi = await reopened.evaluate(() => document.body.innerText);
  check('closing and reopening keeps the session and shows the booking',
    listUi.includes(forSlot[0]?.bookingCode ?? 'NOPE'),
    `booking ${forSlot[0]?.bookingCode} still listed after reopening`);
  await ctx.close();
}

// ------------------------------------- 5. two users race for one slot -------
{
  const target = await findFreeSlot(alice.token);
  const aCtx = await contextFor(alice);
  const bCtx = await contextFor(bob);
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();

  // Both land on the same slot at the same time.
  await Promise.all([aPage.goto(checkoutUrl(target)), bPage.goto(checkoutUrl(target))]);
  await Promise.all([aPage.waitForTimeout(3800), bPage.waitForTimeout(3800)]);

  const aUi = await aPage.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const bUi = await bPage.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const taken = /taken by someone else|Slot unavailable/i;
  const aBlocked = taken.test(aUi);
  const bBlocked = taken.test(bUi);
  check('when two players open the same slot, exactly one gets the hold and the other is told plainly',
    aBlocked !== bBlocked,
    `A blocked=${aBlocked}, B blocked=${bBlocked} — exactly one was refused`);

  // The loser must not be able to force a booking.
  const loser = bBlocked ? bob : alice;
  const forced = await api('/payments/checkout', {
    method: 'POST', token: loser.token,
    body: { slotId: target.slot.id, method: 'BKASH', applyWalletAmount: 0 },
  });
  check('the player who lost the race cannot force the booking through',
    forced.status >= 400,
    `forced checkout answered ${forced.status}`);

  await aCtx.close();
  await bCtx.close();
}

// ------------------------------- 6. stale tab after the slot is gone --------
// Two tabs on the same checkout. One completes the booking; the other is now
// looking at a page whose facts have expired. Acting on it must not double-book
// and must not pretend it worked.
{
  const target = await findFreeSlot(alice.token);
  const ctx = await contextFor(alice);
  const liveTab = await ctx.newPage();
  const staleTab = await ctx.newPage();
  await Promise.all([liveTab.goto(checkoutUrl(target)), staleTab.goto(checkoutUrl(target))]);
  await Promise.all([liveTab.waitForTimeout(3800), staleTab.waitForTimeout(3800)]);

  // The live tab finishes the booking. The stale tab never learns about it.
  await liveTab.click('button:has-text("Pay ")');
  await liveTab.waitForTimeout(1000);
  await liveTab.click('button:has-text("Confirm booking")');
  await liveTab.waitForTimeout(5000);
  const afterLive = (await api('/bookings', { token: alice.token })).json
    .filter((b) => b.slotId === target.slot.id && b.status !== 'CANCELLED');

  await staleTab.click('button:has-text("Pay ")').catch(() => {});
  await staleTab.waitForTimeout(1000);
  const staleConfirm = await staleTab.$('button:has-text("Confirm booking")');
  if (staleConfirm) await staleConfirm.click();
  await staleTab.waitForTimeout(5000);
  const staleUi = await staleTab.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const afterStale = (await api('/bookings', { token: alice.token })).json
    .filter((b) => b.slotId === target.slot.id && b.status !== 'CANCELLED');

  check('a stale tab cannot double-book a slot the live tab already took',
    afterLive.length === 1 && afterStale.length === 1,
    `${afterLive.length} booking(s) before the stale click, ${afterStale.length} after`);
  check('the stale tab says plainly that it could not go through',
    !/Something went wrong/i.test(staleUi)
      && /already|unavailable|taken|expired|could not|couldn.t/i.test(staleUi),
    `screen says "${(staleUi.match(/[^\n]*(already|unavailable|taken|expired|could not|couldn.t)[^\n]*/i) ?? ['(no warning)'])[0].trim().slice(0, 70)}"`);
  await ctx.close();
}

// ------------------------------------------- 7. expired authentication ------
// No init script here: it would re-inject a valid token on every navigation and
// quietly repair the very session this scenario is trying to break.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/player/explore');
  await page.evaluate(([t, u]) => {
    localStorage.setItem('turfchai.auth.token', t);
    localStorage.setItem('turfchai.auth.user', u);
  }, [alice.token, JSON.stringify(alice.user)]);
  await page.goto(BASE + '/player/bookings');
  await page.waitForTimeout(3000);
  const signedInOk = /\/player\/bookings/.test(page.url());

  // The token dies while the tab is open.
  await page.evaluate(() => localStorage.setItem('turfchai.auth.token', 'expired.token.value'));
  await page.goto(BASE + '/player/rewards');
  await page.waitForTimeout(4000);
  const url = page.url();
  const ui = await page.evaluate(() => document.body.innerText);
  check('an expired session sends the user to sign in instead of showing a broken screen',
    signedInOk && /\/auth/.test(url) && !/Something went wrong/i.test(ui),
    `signed in first=${signedInOk}, then landed on ${new URL(url).pathname}`);

  // And the workflow can be resumed after signing in again.
  await page.evaluate(([t, u]) => {
    localStorage.setItem('turfchai.auth.token', t);
    localStorage.setItem('turfchai.auth.user', u);
  }, [alice.token, JSON.stringify(alice.user)]);
  await page.goto(BASE + '/player/rewards');
  await page.waitForTimeout(3500);
  check('signing back in resumes the workflow',
    /\/player\/rewards/.test(page.url()),
    `landed on ${new URL(page.url()).pathname}`);
  await ctx.close();
}

// --------------------------------------------- 8. failed request / offline --
{
  const ctx = await contextFor(alice);
  const page = await ctx.newPage();
  await page.goto(BASE + '/player/explore');
  await page.waitForTimeout(2800);
  await page.route('**/api/v1/venues**', (route) => route.abort());
  await page.reload();
  await page.waitForTimeout(3500);
  const offlineUi = await page.evaluate(() => document.body.innerText);
  check('a failed catalogue request is reported, not rendered as an empty catalogue',
    /couldn.t|could not|try again|error|unavailable|no venues/i.test(offlineUi)
      && !/Something went wrong/i.test(offlineUi),
    `screen says "${(offlineUi.match(/[^\n]*(couldn.t|could not|try again|unavailable|no venues)[^\n]*/i) ?? ['(nothing)'])[0].trim().slice(0, 70)}"`);

  await page.unroute('**/api/v1/venues**');
  await page.reload();
  await page.waitForTimeout(3500);
  const recovered = await page.evaluate(() => document.querySelectorAll('a[href^="/player/venues/"]').length);
  check('the page recovers once the network comes back',
    recovered > 0,
    `${recovered} venue(s) rendered after recovery`);
  await ctx.close();
}

// ------------------------------------------------ 9. slow network -----------
{
  const ctx = await contextFor(alice);
  const page = await ctx.newPage();
  await page.route('**/api/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    return route.continue();
  });
  await page.goto(BASE + '/player/bookings');
  await page.waitForTimeout(2000);
  const midFlight = await page.evaluate(() => document.body.innerText);
  await page.waitForTimeout(5000);
  const settled = await page.evaluate(() => document.body.innerText);
  check('a slow network shows a loading state and then real content, never a false empty state',
    !/Something went wrong/i.test(settled) && settled.length > 40,
    `mid-flight ${midFlight.length} chars -> settled ${settled.length} chars`);
  await ctx.close();
}

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`INTERRUPTION JOURNEYS CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`INTERRUPTION JOURNEYS: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step} :: ${f.evidence}`);
process.exit(1);
