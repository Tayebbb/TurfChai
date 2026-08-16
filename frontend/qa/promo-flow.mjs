// Live proof that a promo code created by an owner is redeemable by a player,
// priced by the server, and released when the booking is cancelled.
//
//   node qa/promo-flow.mjs
const API = 'http://localhost:8080/api/v1';
const OWNER = { email: 'brishty.ahmed.285@gmail.com', password: 'Demo@12345' };

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
const money = (v) => Math.round(Number(v ?? 0));

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}
async function registerPlayer(tag) {
  const email = `promo.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: `Promo ${tag}`, email, password: 'Demo@12345',
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  return login({ email, password: 'Demo@12345' });
}

const owner = await login(OWNER);
const venue = (await api('/owner/venues', { token: owner.token })).json[0];

/** A free, bookable slot at this venue that no other probe has taken. */
const taken = new Set();
async function freeSlot() {
  for (let d = 1; d <= 6; d += 1) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const slots = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
    const free = (Array.isArray(slots) ? slots : [])
      .find((s) => s.status === 'AVAILABLE' && s.bookable && !taken.has(s.id));
    if (free) { taken.add(free.id); return free; }
  }
  throw new Error('no bookable slot at the owner venue');
}

const CODE = `LIVE${Date.now() % 100000}`;
const promo = await api(`/owner/venues/${venue.id}/promotions`, {
  method: 'POST', token: owner.token,
  body: {
    code: CODE, label: 'Live flow promo', discountType: 'PERCENT', discountValue: 25,
    minOrderAmount: 500, maxDiscountAmount: 400, usageLimit: 2,
  },
});
console.log(`\nowner created ${CODE} (25%, min 500, cap 400, limit 2) at ${venue.name}\n`);

// -- a player redeems it ----------------------------------------------------
const player = await registerPlayer('buyer');
const slot = await freeSlot();
const price = money(slot.price);
await api('/bookings/hold-slot', { method: 'POST', token: player.token, body: { slotId: slot.id } });

const quote = await api('/promotions/validate-code', {
  method: 'POST', body: { code: CODE, orderTotal: price, venueId: venue.id },
});
const expected = Math.min(Math.round(price * 0.25), 400);
check('the checkout quote matches the terms the owner set',
  quote.status === 200 && quote.json.valid && money(quote.json.discountAmount) === expected,
  `৳${price} slot -> discount ৳${money(quote.json?.discountAmount)} (25% capped at 400 = ৳${expected})`);

const paid = await api('/payments/checkout', {
  method: 'POST', token: player.token,
  body: { slotId: slot.id, method: 'BKASH', applyWalletAmount: 0, promoCode: CODE },
});
const bookingId = paid.json?.bookingId ?? unwrap(paid.json)?.bookingId;
const booking = (await api(`/bookings/${bookingId}`, { token: player.token })).json;
const ledger = unwrap((await api(`/payments/booking/${bookingId}`, { token: player.token })).json);
const ledgerTotal = ledger.reduce((s, p) => s + money(p.amount), 0);

// `BookingResponse` exposes the gross price as `amount` and the charged price
// as `netAmount`.
check('the booking is charged the discounted price, and the ledger agrees',
  money(booking.amount) === price
    && money(booking.discountAmount) === expected
    && money(booking.netAmount) === price - expected
    && ledgerTotal === price - expected,
  `gross ৳${money(booking.amount)} − discount ৳${money(booking.discountAmount)} = net ৳${money(booking.netAmount)}, ledger ৳${ledgerTotal}`);

check('the booking records which code it redeemed',
  booking.promoCode === CODE,
  `booking.promoCode = ${booking.promoCode}`);

const afterOne = (await api(`/owner/venues/${venue.id}/promotions`, { token: owner.token })).json
  .find((p) => p.code === CODE);
check('the owner sees the redemption on their own promotion',
  afterOne.usageCount === 1,
  `usageCount = ${afterOne.usageCount} of limit ${afterOne.usageLimit}`);

// -- the client cannot dictate the discount ---------------------------------
{
  const cheater = await registerPlayer('cheater');
  const s = await freeSlot();
  await api('/bookings/hold-slot', { method: 'POST', token: cheater.token, body: { slotId: s.id } });
  const forced = await api('/payments/checkout', {
    method: 'POST', token: cheater.token,
    body: { slotId: s.id, method: 'BKASH', applyWalletAmount: 0, promoCode: CODE, discountAmount: 99999, netAmount: 1 },
  });
  const forcedId = forced.json?.bookingId ?? unwrap(forced.json)?.bookingId;
  const b = (await api(`/bookings/${forcedId}`, { token: cheater.token })).json;
  check('a client-supplied discount is ignored; the server prices it',
    money(b.amount) > 0
      && money(b.discountAmount) === Math.min(Math.round(money(b.amount) * 0.25), 400)
      && money(b.netAmount) === money(b.amount) - money(b.discountAmount),
    `client asked for ৳99999 off, server applied ৳${money(b.discountAmount)} on a ৳${money(b.amount)} slot`);

  // That was the second and last use.
  const exhausted = (await api(`/owner/venues/${venue.id}/promotions`, { token: owner.token })).json
    .find((p) => p.code === CODE);
  check('the usage limit closes the promotion once it is spent',
    exhausted.usageCount === 2 && exhausted.active === false,
    `usageCount ${exhausted.usageCount}/${exhausted.usageLimit}, active=${exhausted.active}`);

  const third = await registerPlayer('third');
  const s3 = await freeSlot();
  await api('/bookings/hold-slot', { method: 'POST', token: third.token, body: { slotId: s3.id } });
  const refused = await api('/payments/checkout', {
    method: 'POST', token: third.token,
    body: { slotId: s3.id, method: 'BKASH', applyWalletAmount: 0, promoCode: CODE },
  });
  check('an exhausted code is refused at checkout and books nothing',
    refused.status === 422,
    `HTTP ${refused.status} ${String(refused.text).slice(0, 80)}`);

  // The refused checkout must not have consumed a use or left a confirmed booking.
  const stillTwo = (await api(`/owner/venues/${venue.id}/promotions`, { token: owner.token })).json
    .find((p) => p.code === CODE);
  const noBooking = (await api('/bookings', { token: third.token })).json
    .filter((b2) => b2.status === 'CONFIRMED');
  check('a refused checkout consumes no usage and confirms no booking',
    stillTwo.usageCount === 2 && noBooking.length === 0,
    `usageCount still ${stillTwo.usageCount}, confirmed bookings for that player: ${noBooking.length}`);
}

// -- cancelling hands the use back ------------------------------------------
{
  await api(`/payments/cancel/${bookingId}`, { method: 'POST', token: player.token });
  const released = (await api(`/owner/venues/${venue.id}/promotions`, { token: owner.token })).json
    .find((p) => p.code === CODE);
  check('cancelling a booking hands its redemption back',
    released.usageCount === 1 && released.active === true,
    `usageCount ${released.usageCount}/${released.usageLimit}, active=${released.active}`);
}

// -- refusal reasons --------------------------------------------------------
{
  const price2 = 300;
  const belowMin = await api('/promotions/validate-code', {
    method: 'POST', body: { code: CODE, orderTotal: price2, venueId: venue.id },
  });
  check('an order below the minimum is refused with the reason',
    belowMin.json?.valid === false && /minimum/i.test(belowMin.json?.message ?? ''),
    `"${belowMin.json?.message}"`);

  const unknown = await api('/promotions/validate-code', {
    method: 'POST', body: { code: 'NOSUCHCODE', orderTotal: 2000, venueId: venue.id },
  });
  check('an unknown code is refused', unknown.json?.valid === false, `"${unknown.json?.message}"`);

  const wrongVenue = await api('/promotions/validate-code', {
    method: 'POST', body: { code: CODE, orderTotal: 2000, venueId: venue.id + 999 },
  });
  check('a code does not work at another venue', wrongVenue.json?.valid === false, `"${wrongVenue.json?.message}"`);
}

await api(`/owner/venues/${venue.id}/promotions/${promo.json?.id}`, { method: 'DELETE', token: owner.token });

console.log('');
if (failures.length === 0) {
  console.log(`PROMO FLOW CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`PROMO FLOW: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
