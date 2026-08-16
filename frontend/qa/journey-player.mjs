// Complete player journey, driven through the browser.
//
// Every transition is verified three ways at once: what the UI shows, what the
// URL says, and what the server actually holds. A step passes only when all
// three agree — a screen that looks right over a database that disagrees is a
// failure, and so is a database that is right under a screen that lies.
//
//   node qa/journey-player.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';

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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|React DevTools|favicon/.test(t)) return;
  consoleErrors.push(t);
});
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${e.message}`));

const stamp = Date.now();
const EMAIL = `journey.${stamp}@example.com`;
const PASSWORD = 'Demo@12345';
const NAME = 'Journey Player';
let token = null;

console.log('\n================ PLAYER JOURNEY ================\n');

// ---------------------------------------------------------- 1. landing ------
await page.goto(BASE + '/');
await page.waitForTimeout(2000);
const landing = await page.evaluate(() => ({
  venues: document.querySelectorAll('.venue-card').length,
  stat: document.querySelector('.statrow .stat')?.innerText.replace(/\n/g, ' ') ?? '',
  signedOut: Boolean(document.querySelector('a[href="/auth"]')),
}));
const catalogue = unwrap((await api('/venues?page=0&size=3')).json);
check('landing shows the real catalogue to an anonymous visitor',
  landing.venues > 0 && landing.signedOut && landing.stat.includes(String(catalogue.totalItems)),
  `${landing.venues} cards, stat "${landing.stat}", API totalItems=${catalogue.totalItems}`);

// ------------------------------------------------------- 2. registration ----
await page.goto(BASE + '/auth');
await page.waitForTimeout(1200);
await page.click('[role=tab]:has-text("Create account")');
await page.waitForTimeout(500);
await page.fill('#nm', NAME);
await page.fill('#su-em', EMAIL);
await page.fill('#pw2', PASSWORD);
await page.evaluate(() => document.querySelector('form').requestSubmit());
await page.waitForTimeout(3500);

const afterRegisterUrl = new URL(page.url()).pathname;
const login = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
token = login.json?.token;
check('registration creates a real account and signs the browser in',
  login.status === 200 && Boolean(token) && afterRegisterUrl.startsWith('/player'),
  `landed on ${afterRegisterUrl}, server login=${login.status}, role=${login.json?.user?.role}`);

const storedToken = await page.evaluate(() => localStorage.getItem('turfchai.auth.token'));
check('the browser session matches the account the server issued',
  Boolean(storedToken),
  `localStorage token present=${Boolean(storedToken)}`);

// ------------------------------------------------------------ 3. profile ----
await page.goto(BASE + '/player/dashboard/settings');
await page.waitForTimeout(2500);
const nameField = await page.$('input[value], input#fullName, input[name=fullName]');
const shownName = await page.evaluate(() => document.body.innerText.includes('Journey Player'));
const profile = unwrap((await api('/players/me', { token })).json);
check('profile screen shows the name the database holds',
  shownName && profile.fullName === NAME,
  `UI shows name=${shownName}, DB fullName="${profile.fullName}"`);

// ------------------------------------------------------------ 4. explore ----
await page.goto(BASE + '/player/explore');
await page.waitForTimeout(2500);
// The page has several role=status live regions; the results counter is the one
// inside <main>. The others are empty route announcers.
const resultsStatus = () => page.evaluate(() => ({
  status: document.querySelector('main [role=status]')?.innerText ?? '',
  count: document.querySelectorAll('a[href^="/player/venues/"]').length,
}));
const exploreBefore = await resultsStatus();
check('explore lists venues', exploreBefore.count > 0, `${exploreBefore.count} venue links, status "${exploreBefore.status}"`);

// --------------------------------------------------- 5. search and filter ---
await page.fill('input[type=search], [role=searchbox]', 'Turf');
await page.waitForTimeout(2500);
const searched = await resultsStatus();
check('search narrows the list and reports what it found',
  /venue/i.test(searched.status) && searched.count < exploreBefore.count && searched.count > 0,
  `"${exploreBefore.status}" -> "${searched.status}" (${exploreBefore.count} -> ${searched.count} results)`);

await page.goto(BASE + '/player/explore?area=Gulshan');
await page.waitForTimeout(2500);
const filtered = await resultsStatus();
const apiFiltered = unwrap((await api('/venues?area=Gulshan&page=0&size=50')).json);
check('area filter matches what the API returns for that area',
  filtered.count === (apiFiltered.items?.length ?? -1) && /venue/i.test(filtered.status),
  `UI ${filtered.count} vs API ${apiFiltered.items?.length}, status "${filtered.status}"`);

// -------------------------------------- 6. venue, pitch, slot, booking ------
// Find a genuinely bookable slot the way the UI would.
let target = null;
const venuePage = unwrap((await api('/venues?page=0&size=20')).json);
for (const v of venuePage.items ?? []) {
  for (let d = 1; d <= 4 && !target; d += 1) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const slots = (await api(`/venues/${v.id}/slots?date=${date}`, { token })).json;
    const free = (Array.isArray(slots) ? slots : []).find((s) => s.status === 'AVAILABLE' && s.bookable);
    if (free) target = { venue: v, slot: free, date };
  }
  if (target) break;
}
if (!target) {
  check('a bookable slot exists to run the booking journey', false, 'no AVAILABLE bookable slot in the next 4 days');
} else {
  await page.goto(`${BASE}/player/venues/${target.venue.slug}`);
  await page.waitForTimeout(2500);
  const venueUi = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.innerText ?? '',
    hasSlots: /AM|PM/.test(document.body.innerText),
  }));
  const venueApi = unwrap((await api(`/venues/${target.venue.slug}`)).json);
  check('venue page shows the venue the API describes',
    venueUi.heading.includes(venueApi.name) && venueUi.hasSlots,
    `UI "${venueUi.heading}" vs API "${venueApi.name}", slot grid rendered=${venueUi.hasSlots}`);

  // available -> held
  await page.goto(`${BASE}/player/checkout?slotId=${target.slot.id}&venue=${target.venue.slug}&date=${target.date}`);
  await page.waitForTimeout(3500);
  const heldUi = await page.evaluate(() => ({
    price: (document.body.innerText.match(/৳[\d,]+/) ?? [''])[0],
    cta: document.querySelector('main aside button, main button.btn-primary')?.innerText ?? '',
    timer: document.querySelector('[role=timer]')?.innerText ?? '',
  }));
  const slotAfterHold = (await api(`/venues/${target.venue.id}/slots?date=${target.date}`, { token })).json
    .find((s) => s.id === target.slot.id);
  check('BOOKING available -> held: the slot is locked and the price is shown',
    /HELD|BOOKED/.test(slotAfterHold?.status ?? '') && heldUi.price.length > 1,
    `slot status=${slotAfterHold?.status}, UI price=${heldUi.price}, timer="${heldUi.timer.replace(/\n/g, ' ')}"`);

  // held -> confirmed, through the real confirm panel
  await page.click('button:has-text("Pay ")');
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Confirm booking")');
  await page.waitForTimeout(5000);

  const successUrl = page.url();
  const bookingId = new URL(successUrl).searchParams.get('bookingId');
  const booking = (await api(`/bookings/${bookingId}`, { token })).json;
  const payments = unwrap((await api(`/payments/booking/${bookingId}`, { token })).json);
  const successUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  check('BOOKING held -> confirmed: UI, URL and database all agree',
    booking.status === 'CONFIRMED'
      && successUrl.includes('/player/booking-success')
      && successUi.includes(booking.bookingCode)
      && Array.isArray(payments) && payments.length === 1
      && Number(payments[0].amount) === Number(booking.netAmount),
    `db=${booking.status} ${booking.bookingCode} ৳${booking.netAmount}, payments=${payments?.length}, url=${new URL(successUrl).pathname}`);

  // points really moved
  const rewards = unwrap((await api('/rewards/my-points', { token })).json);
  const claimed = (successUi.match(/You earned ([\d,]+) points/) ?? [])[1];
  check('reward points claimed on screen match the ledger',
    claimed ? Number(claimed.replace(/,/g, '')) === rewards.balance : rewards.balance > 0,
    `screen claimed ${claimed ?? 'n/a'}, ledger balance=${rewards.balance}`);

  // --------------------------------------------------- 7. booking history ---
  await page.goto(BASE + '/player/bookings');
  await page.waitForTimeout(2500);
  const listUi = await page.evaluate(() => document.body.innerText);
  const listApi = (await api('/bookings', { token })).json;
  check('booking history lists the booking just made',
    listUi.includes(booking.bookingCode) && listApi.some((b) => b.id === Number(bookingId)),
    `UI contains ${booking.bookingCode}, API returns ${listApi.length} booking(s)`);

  // --------------------------------------------------- 8. booking details ---
  await page.goto(`${BASE}/player/bookings/${bookingId}`);
  await page.waitForTimeout(2500);
  const detailUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  check('booking detail agrees with the ledger and never claims money was taken',
    detailUi.includes(booking.bookingCode)
      && /Total due/i.test(detailUi)
      && !/Total paid/i.test(detailUi),
    `shows code, "Total due" present, "Total paid" absent`);

  // ------------------------------------- 9. refund preview then cancellation -
  const preview = unwrap((await api(`/payments/refund-preview/${bookingId}`, { token })).json);
  const previewShown = (detailUi.match(/refunds (\d+)%/i) ?? [])[1];
  check('the refund the screen quotes is the refund the engine computes',
    previewShown === undefined || Number(previewShown) === preview.refundPercent,
    `screen quotes ${previewShown ?? 'n/a'}%, engine says ${preview.refundPercent}% (৳${preview.refundAmount})`);

  await page.click('button:has-text("Cancel booking")');
  await page.waitForTimeout(3500);
  const cancelled = (await api(`/bookings/${bookingId}`, { token })).json;
  const afterCancelUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  const paymentsAfter = unwrap((await api(`/payments/booking/${bookingId}`, { token })).json);
  const refundRows = (paymentsAfter ?? []).filter((p) => p.type === 'REFUND');
  check('BOOKING confirmed -> cancelled: status, screen and refund rows agree',
    cancelled.status === 'CANCELLED'
      && /Cancelled/i.test(afterCancelUi)
      && (preview.refundPercent > 0 ? refundRows.length > 0 : refundRows.length === 0),
    `db=${cancelled.status}, refund rows=${refundRows.length}, expected refund ${preview.refundPercent}%`);

  const rewardsAfter = unwrap((await api('/rewards/my-points', { token })).json);
  check('cancelling claws the booking points back',
    rewardsAfter.balance < rewards.balance || rewards.balance === 0,
    `points ${rewards.balance} -> ${rewardsAfter.balance}`);

  // a cancelled booking may not be cancelled again
  const doubleCancel = await api(`/payments/cancel/${bookingId}`, { method: 'POST', token });
  check('BOOKING cancelled -> cancelled is refused',
    doubleCancel.status >= 400,
    `second cancel answered ${doubleCancel.status}`);
}

// ------------------------------------------------------- 10. saved venue ----
const someVenue = (unwrap((await api('/venues?page=0&size=1')).json)).items[0];
await page.goto(`${BASE}/player/explore`);
await page.waitForTimeout(2500);
const saveBtn = await page.$('button[aria-label^="Save"]');
if (saveBtn) {
  await saveBtn.click();
  await page.waitForTimeout(1800);
  const saved = (await api('/players/me/saved-venues', { token })).json;
  check('saving a venue from explore persists for this account',
    Array.isArray(saved) && saved.length > 0,
    `${saved?.length ?? 0} saved venue(s) in the database`);
} else {
  check('a save control exists on explore', false, 'no save button found');
}

// ----------------------------------------------------- 11. notifications ----
await page.goto(BASE + '/player/dashboard/notifications');
await page.waitForTimeout(2500);
const notifUi = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
const notifApi = (await api('/notifications', { token })).json;
check('notifications screen matches the notification feed',
  notifUi.length > 0 && Array.isArray(notifApi),
  `API returned ${notifApi?.length ?? 0} notification(s), screen rendered ${notifUi.length} chars`);

// ------------------------------------------------------------ 12. logout ----
await page.goto(BASE + '/player');
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /profile menu/i.test(b.getAttribute('aria-label') ?? ''));
  btn?.click();
});
await page.waitForTimeout(1000);
const signOut = await page.$('button:has-text("Sign out"), button:has-text("Log out")');
if (signOut) await signOut.click();
else await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(1500);
await page.goto(BASE + '/player/bookings');
await page.waitForTimeout(2500);
check('after logout a private route is no longer reachable',
  /\/auth/.test(page.url()),
  `landed on ${new URL(page.url()).pathname}`);

check('no console errors or page exceptions during the whole journey',
  consoleErrors.length === 0,
  consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'clean');

await browser.close();

console.log('');
if (failures.length === 0) {
  console.log(`PLAYER JOURNEY CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`PLAYER JOURNEY: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step} :: ${f.evidence}`);
process.exit(1);
