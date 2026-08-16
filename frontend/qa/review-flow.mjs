// Live proof of the whole review chain: who may write one, that it is stored,
// that the venue's rating follows it, that the owner sees it and can answer,
// and that the answer reaches the public page.
//
//   node qa/review-flow.mjs
const API = 'http://localhost:8080/api/v1';
const ADMIN = { email: 'admin0@turfchai.com', password: 'Demo@12345' };

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
const rows = (j) => { const d = unwrap(j); return Array.isArray(d) ? d : (d?.items ?? d?.content ?? []); };
const message = (r) => r.json?.message ?? r.json?.error ?? r.text?.slice(0, 120) ?? '';

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}

/** Admin sign-in is a two-step 2FA exchange. */
async function adminLogin() {
  const c = await api('/admin/auth/login', { method: 'POST', body: ADMIN });
  if (c.status !== 200 || !c.json?.devCode) throw new Error(`admin challenge -> ${c.status} ${c.text}`);
  const v = await api('/admin/auth/login/verify', {
    method: 'POST', body: { challenge: c.json.challenge, code: c.json.devCode },
  });
  if (v.status !== 200) throw new Error(`admin verify -> ${v.status}`);
  return v.json.token;
}

const adminToken = await adminLogin();

// ── find a player with a played, unreviewed booking ─────────────────────────
const candidates = [];
for (let p = 0; p < 3 && candidates.length < 40; p += 1) {
  const roster = unwrap((await api(`/admin/users?page=${p}&size=60&role=PLAYER`, { token: adminToken })).json);
  for (const u of roster?.items ?? []) {
    if (!u.email) continue;
    try { candidates.push(await login({ email: u.email, password: 'Demo@12345' })); } catch { /* other password */ }
    if (candidates.length >= 40) break;
  }
}
if (candidates.length === 0) throw new Error('no player account could be signed in');

const played = (b) => b.status !== 'CANCELLED' && new Date(`${b.bookingDate}T${b.startTime}`) < new Date();

let author = null;
let subject = null;
let future = null;
for (const candidate of candidates) {
  const mine = rows((await api('/bookings', { token: candidate.token })).json);
  const upcoming = mine.find((b) => b.status !== 'CANCELLED' && !played(b));
  if (upcoming && !future) future = { booking: upcoming, actor: candidate };
  for (const b of mine.filter(played)) {
    // A 200 here means this account really was allowed to review this booking.
    const attempt = await api('/reviews', {
      method: 'POST', token: candidate.token,
      body: { bookingId: b.id, venueId: b.venueId, overallRating: 4, comment: 'Review flow probe — turf and lights were both fine.' },
    });
    if (attempt.status === 200) { author = candidate; subject = b; break; }
  }
  if (author) break;
}
if (!author) throw new Error('no player had an unreviewed, already-played booking — cannot prove the chain');

const slug = subject.venueSlug;
console.log(`\nreviewed booking ${subject.bookingCode} at ${slug} as ${author.user.email}\n`);

// ── 1. it is stored, and the public page shows it ───────────────────────────
const feed = rows((await api(`/venues/${slug}/reviews?page=0&size=100`)).json);
const mine = feed.find((r) => String(r.comment ?? '').includes('Review flow probe'));
check('the review the player submitted is on the venue page',
  Boolean(mine) && Number(mine.overallRating ?? mine.rating) === 4,
  `feed holds ${feed.length} review(s); mine rated ${mine?.overallRating ?? mine?.rating}`);
check('the review is attributed to the account that wrote it',
  String(mine?.authorName ?? mine?.author ?? '').split(' ')[0]
    === String(author.user.fullName ?? '').split(' ')[0],
  `attributed to "${mine?.authorName ?? mine?.author}", author is "${author.user.fullName}"`);

// ── 2. the venue's rating follows the reviews it actually has ───────────────
const venue = unwrap((await api(`/venues/${slug}`)).json);
const mean = feed.reduce((s, r) => s + Number(r.overallRating ?? r.rating ?? 0), 0) / feed.length;
check('the venue rating is the average of its published reviews',
  Math.abs(Number(venue.rating ?? 0) - mean) < 0.06,
  `venue says ${venue.rating}, its ${feed.length} reviews average ${mean.toFixed(2)}`);
check('the venue review count matches the reviews it lists',
  venue.reviewCount === feed.length,
  `reviewCount=${venue.reviewCount}, list holds ${feed.length}`);

// ── 3. the duplicate rule ───────────────────────────────────────────────────
{
  const again = await api('/reviews', {
    method: 'POST', token: author.token,
    body: { bookingId: subject.id, venueId: subject.venueId, overallRating: 1, comment: 'second attempt' },
  });
  const after = unwrap((await api(`/venues/${slug}`)).json);
  check('a second review of the same booking is refused, and changes nothing',
    again.status >= 400 && after.reviewCount === venue.reviewCount
      && Number(after.rating) === Number(venue.rating),
    `HTTP ${again.status} "${message(again)}"; rating ${venue.rating}→${after.rating}, count ${venue.reviewCount}→${after.reviewCount}`);
}

// ── 4. eligibility ──────────────────────────────────────────────────────────
{
  const stranger = candidates.find((c) => c.user.id !== author.user.id);
  const theirs = await api('/reviews', {
    method: 'POST', token: stranger.token,
    body: { bookingId: subject.id, venueId: subject.venueId, overallRating: 5, comment: 'not my booking' },
  });
  check("a player cannot review somebody else's booking",
    theirs.status >= 400 && /own booking|not found|permission/i.test(message(theirs)),
    `HTTP ${theirs.status} "${message(theirs)}"`);

  const anon = await api('/reviews', {
    method: 'POST',
    body: { bookingId: subject.id, venueId: subject.venueId, overallRating: 5, comment: 'anonymous' },
  });
  check('a signed-out visitor cannot review at all',
    anon.status === 401 || anon.status === 403,
    `HTTP ${anon.status}`);
}

if (!future) throw new Error('no upcoming booking available to prove the not-yet-played rule');
{
  // Must be asked by the player who owns it, or the refusal proves ownership
  // rather than the timing rule.
  const early = await api('/reviews', {
    method: 'POST', token: future.actor.token,
    body: { bookingId: future.booking.id, venueId: future.booking.venueId, overallRating: 5, comment: 'too early' },
  });
  check('a match that has not started yet cannot be reviewed, and the reason says so',
    early.status >= 400 && /started/i.test(message(early)),
    `own booking ${future.booking.bookingCode} on ${future.booking.bookingDate} -> HTTP ${early.status} "${message(early)}"`);
}

{
  const missing = await api('/reviews', {
    method: 'POST', token: author.token,
    body: { bookingId: 99999999, venueId: subject.venueId, overallRating: 5, comment: 'no such booking' },
  });
  check('an unknown booking is refused rather than accepted against a venue',
    missing.status >= 400 && missing.status < 500,
    `HTTP ${missing.status} "${message(missing)}"`);

  const outOfRange = await api('/reviews', {
    method: 'POST', token: author.token,
    body: { bookingId: subject.id, venueId: subject.venueId, overallRating: 9, comment: 'nine stars' },
  });
  check('a rating outside 1–5 is refused',
    outOfRange.status === 400,
    `overallRating 9 -> HTTP ${outOfRange.status}`);
}

// ── 5. the owner sees it, and can answer it ─────────────────────────────────
const venueAdmin = unwrap((await api(`/admin/venues/${venue.id}`, { token: adminToken })).json);
// The venue's contact address is not necessarily a login; the owning account is.
let owner = null;
let ownerRow = null;
for (const role of ['OWNER', 'HOST', '']) {
  for (let p = 0; p < 6 && !ownerRow; p += 1) {
    const q = `/admin/users?page=${p}&size=60${role ? `&role=${role}` : ''}`;
    const roster = unwrap((await api(q, { token: adminToken })).json);
    const items = roster?.items ?? [];
    if (items.length === 0) break;
    ownerRow = items.find((u) => u.id === venueAdmin?.ownerId) ?? null;
  }
  if (ownerRow) break;
}
if (!ownerRow?.email) throw new Error(`could not resolve the owning account (id ${venueAdmin?.ownerId}) of ${slug}`);
try { owner = await login({ email: ownerRow.email, password: 'Demo@12345' }); }
catch { throw new Error(`owner ${ownerRow.email} of ${slug} could not be signed in`); }

{
  const summary = unwrap((await api('/owner/reviews', { token: owner.token })).json);
  const seen = (summary?.items ?? []).find((r) => String(r.text ?? r.comment ?? '').includes('Review flow probe'));
  check('the venue owner sees the review a player left on their venue',
    Boolean(seen) && seen.rating === 4 && seen.needsResponse === true,
    `owner console lists ${summary?.items?.length ?? 0} review(s); mine rated ${seen?.rating}, awaiting a reply: ${seen?.needsResponse}`);
  check('the owner summary agrees with the venue rating',
    Math.abs(Number(summary?.averageRating ?? 0) - mean) < 0.06,
    `owner reports ${summary?.averageRating}, public reviews average ${mean.toFixed(2)}`);

  const REPLY = 'Thanks for playing — the floodlights were serviced last week.';
  const replied = await api(`/owner/reviews/${seen.id}/response`, {
    method: 'POST', token: owner.token, body: { response: REPLY },
  });
  const publicAfter = rows((await api(`/venues/${slug}/reviews?page=0&size=100`)).json)
    .find((r) => String(r.comment ?? '').includes('Review flow probe'));
  check("the owner's reply is stored and shown under the review publicly",
    replied.status === 200 && publicAfter?.ownerResponse === REPLY,
    `reply -> ${replied.status}; public page shows "${String(publicAfter?.ownerResponse ?? '').slice(0, 40)}…"`);

  const blank = await api(`/owner/reviews/${seen.id}/response`, {
    method: 'POST', token: owner.token, body: { response: '   ' },
  });
  check('an empty reply is refused rather than published',
    blank.status === 400,
    `blank reply -> HTTP ${blank.status}`);

  const foreign = await api(`/owner/reviews/${seen.id}/response`, {
    method: 'POST', token: author.token, body: { response: 'I am not the owner' },
  });
  check('a player cannot answer a review as the venue',
    foreign.status === 401 || foreign.status === 403,
    `player replying -> HTTP ${foreign.status}`);
}

console.log('');
if (failures.length === 0) {
  console.log(`REVIEW FLOW CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`REVIEW FLOW: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
