// Live proof that a player's notification feed is a record of what actually
// happened to them: written by the backend at the state transition, scoped to
// its owner, and durable across a reload.
//
//   node qa/notification-flow.mjs
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

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}
async function registerPlayer(tag) {
  const email = `notif.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: `Notif ${tag}`, email, password: 'Demo@12345',
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  return login({ email, password: 'Demo@12345' });
}

const feed = async (who) => (await api('/notifications', { token: who.token })).json ?? [];
const unread = async (who) => Number(unwrap((await api('/notifications/unread-count', { token: who.token })).json)?.count ?? 0);
const ofType = (rows, type) => rows.filter((n) => n.type === type);

const owner = await login(OWNER);
const venue = (await api('/owner/venues', { token: owner.token })).json[0];

const taken = new Set();
async function freeSlot() {
  for (let d = 1; d <= 8; d += 1) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const slots = (await api(`/venues/${venue.id}/slots?date=${date}`)).json;
    const free = (Array.isArray(slots) ? slots : [])
      .find((s) => s.status === 'AVAILABLE' && s.bookable && !taken.has(s.id));
    if (free) { taken.add(free.id); return free; }
  }
  throw new Error('no bookable slot at the owner venue');
}

async function bookAndPay(who) {
  const slot = await freeSlot();
  await api('/bookings/hold-slot', { method: 'POST', token: who.token, body: { slotId: slot.id } });
  const paid = await api('/payments/checkout', {
    method: 'POST', token: who.token,
    body: { slotId: slot.id, method: 'BKASH', applyWalletAmount: 0 },
  });
  if (paid.status !== 200) throw new Error(`checkout -> ${paid.status} ${paid.text}`);
  return unwrap(paid.json).bookingId;
}

console.log(`\nusing ${venue.name}\n`);

// -- 1. a brand-new player starts with nothing -------------------------------
const player = await registerPlayer('main');
{
  const rows = await feed(player);
  check('a player who has done nothing has an empty feed and a zero badge',
    rows.length === 0 && (await unread(player)) === 0,
    `${rows.length} notification(s), unread badge 0`);
}

// -- 2. confirming a booking writes one ---------------------------------------
const bookingId = await bookAndPay(player);
{
  const rows = await feed(player);
  const confirmed = ofType(rows, 'BOOKING_CONFIRMED');
  check('paying for a slot notifies the player who booked it',
    confirmed.length === 1 && confirmed[0].isRead === false,
    `${confirmed.length} BOOKING_CONFIRMED, isRead=${confirmed[0]?.isRead}, title="${confirmed[0]?.title}"`);
  check('the notification links to the booking it is about',
    confirmed[0]?.link === `/player/bookings/${bookingId}`,
    `link=${confirmed[0]?.link} for booking ${bookingId}`);
  check('the unread badge counts it',
    (await unread(player)) === rows.filter((n) => !n.isRead).length,
    `badge ${await unread(player)}, unread rows ${rows.filter((n) => !n.isRead).length}`);
}

// -- 3. opening it marks it read, and that survives a reload -------------------
{
  const target = ofType(await feed(player), 'BOOKING_CONFIRMED')[0];
  const before = await unread(player);
  const marked = await api(`/notifications/${target.id}/read`, { method: 'POST', token: player.token });
  const after = await unread(player);
  const reloaded = (await feed(player)).find((n) => n.id === target.id);
  check('opening a notification marks it read and drops the badge',
    marked.status === 200 && after === before - 1 && reloaded.isRead === true,
    `badge ${before} -> ${after}, isRead=${reloaded?.isRead} on a fresh read`);
}

// -- 4. another player cannot touch it ----------------------------------------
const intruder = await registerPlayer('intruder');
const intruderBooking = await bookAndPay(intruder); // so their badge is non-zero and worth protecting
{
  const target = ofType(await feed(player), 'BOOKING_CONFIRMED')[0];
  const stolen = await api(`/notifications/${target.id}/read`, { method: 'POST', token: intruder.token });
  const anon = await api('/notifications');
  check('another player cannot mark somebody else\'s notification',
    stolen.status >= 400,
    `POST /notifications/${target.id}/read as a different player -> ${stolen.status}`);
  check('the feed is not readable without a session',
    anon.status === 401 || anon.status === 403,
    `GET /notifications with no token -> ${anon.status}`);
  const theirs = await feed(intruder);
  check('each player\'s feed holds only their own events',
    theirs.length > 0
      && theirs.every((n) => n.link !== `/player/bookings/${bookingId}`)
      && theirs.some((n) => n.link === `/player/bookings/${intruderBooking}`),
    `other player has ${theirs.length} notification(s), about booking ${intruderBooking}, none about ${bookingId}`);
}

// -- 5. the venue cancelling tells the player ---------------------------------
const cancelled = await bookAndPay(player);
{
  const refund = await api(`/owner/bookings/${cancelled}/refund`, { method: 'POST', token: owner.token });
  const rows = await feed(player);
  const cancels = ofType(rows, 'BOOKING_CANCELLED').filter((n) => n.link === `/player/bookings/${cancelled}`);
  const refunds = ofType(rows, 'REFUND_ISSUED').filter((n) => n.link === `/player/bookings/${cancelled}`);
  const amount = Number(unwrap(refund.json)?.refundAmount ?? 0);
  check('a booking the venue cancels is reported to the player who made it',
    refund.status === 200 && cancels.length === 1
      && /by the venue/i.test(cancels[0].body ?? ''),
    `"${cancels[0]?.body}"`);
  check('the refund is reported with the amount that actually moved',
    amount > 0 ? refunds.length === 1 && refunds[0].title.includes(String(Math.round(amount)))
      : refunds.length === 0,
    `refundAmount ৳${amount}, ${refunds.length} REFUND_ISSUED "${refunds[0]?.title ?? ''}"`);
}

// -- 6. repeating the event does not stack the feed ---------------------------
{
  const before = ofType(await feed(player), 'BOOKING_CANCELLED').length;
  const again = await api(`/owner/bookings/${cancelled}/refund`, { method: 'POST', token: owner.token });
  const after = ofType(await feed(player), 'BOOKING_CANCELLED').length;
  check('cancelling an already-cancelled booking adds no second notification',
    again.status >= 400 && after === before,
    `second refund -> ${again.status}, BOOKING_CANCELLED count ${before} -> ${after}`);
}

// -- 7. registering for a tournament is reported ------------------------------
{
  // openOnly filters the public listing, not who may register — an invite-only
  // tournament is still registerable, so browse everything the player can see.
  const open = (unwrap((await api('/tournaments?openOnly=false&upcomingOnly=true&size=50',
    { token: player.token })).json)?.items ?? [])
    .find((t) => t.spotsLeft > 0 && !t.myRegistrationCode
      && (t.status === 'PUBLISHED' || t.status === 'CONFIRMED'));
  if (!open) throw new Error('no registerable tournament in the seed data — this check cannot be proven');

  const reg = await api(`/tournaments/${open.code}/register`, {
    method: 'POST', token: player.token,
    body: {
      teamName: `Notif FC ${Date.now() % 100000}`, captainName: 'Notif Captain',
      contactPhone: '+8801700000000', jerseyNumber: '7', skillLevel: 'INTERMEDIATE',
      agreedToRules: true,
    },
  });
  const rows = ofType(await feed(player), 'TOURNAMENT_REGISTERED')
    .filter((n) => n.link === `/player/tournaments/${open.code}`);
  check('a tournament registration is reported to the player',
    reg.status === 201 && rows.length === 1,
    `${open.code} register -> ${reg.status}, "${rows[0]?.title ?? ''}"`);
  check('the registration notification states the fee that is actually due',
    rows[0]?.body?.includes(String(Math.round(open.entryFeePerTeam))),
    `entry fee ৳${open.entryFeePerTeam} — "${rows[0]?.body ?? ''}"`);

  // Hand the seat back so re-running this probe does not fill the tournament.
  await api(`/tournaments/${open.code}/register`, { method: 'DELETE', token: player.token });
}

// -- 8. mark-all-read is scoped to the caller ---------------------------------
{
  const otherBefore = await unread(intruder);
  if (otherBefore === 0) throw new Error('the other player has nothing unread — this check would be vacuous');
  await api('/notifications/read-all', { method: 'POST', token: player.token });
  check('mark-all-read clears only the caller\'s feed',
    (await unread(player)) === 0 && (await unread(intruder)) === otherBefore,
    `player badge 0, other player still ${await unread(intruder)} of ${otherBefore}`);
}

// -- 9. every notification is honestly shaped ---------------------------------
{
  const rows = await feed(player);
  const bad = rows.filter((n) => !n.type || !n.title || !n.createdAt
    || /undefined|null|NaN/.test(`${n.title} ${n.body ?? ''}`));
  check('no notification renders a placeholder value',
    bad.length === 0,
    `${rows.length} notification(s) checked, ${bad.length} with a placeholder`);
  check('the feed never leaks the owning user id',
    rows.every((n) => !('userId' in n)),
    'no userId field on any row');
}

console.log('');
if (failures.length === 0) {
  console.log(`NOTIFICATION FLOW CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`NOTIFICATION FLOW: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
