// Live proof that the solo "open games" feature does what the screens claim:
// a player posts a game, other players claim spots, the roster and capacity
// track it, and the rules that protect a game are actually enforced.
//
//   node qa/open-games-flow.mjs
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

async function login({ email, password }) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.json.token, user: r.json.user };
}
async function registerPlayer(tag) {
  const email = `solo.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const r = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: `Solo ${tag}`, email, password: 'Demo@12345',
      phone: `+8801${Math.floor(100000000 + Math.random() * 899999999)}`, role: 'PLAYER',
    },
  });
  if (r.status >= 400) throw new Error(`register ${tag} -> ${r.status} ${r.text}`);
  return login({ email, password: 'Demo@12345' });
}

const venue = (unwrap((await api('/venues?page=0&size=1')).json)?.items ?? [])[0];
if (!venue) throw new Error('no venue to host an open game at');

const host = await registerPlayer('host');
const gameDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const TITLE = `Probe game ${Date.now() % 1000000}`;

// -- 1. posting a game -------------------------------------------------------
const created = await api('/solo/open-games', {
  method: 'POST', token: host.token,
  body: {
    title: TITLE, venueId: venue.id, gameDate,
    startTime: '21:00:00', endTime: '22:30:00',
    skillLevel: 'ALL_LEVELS', capacity: 3, pricePerPlayer: 250, minimumReliability: 0,
  },
});
const game = created.json;
check('a player can post an open game, and takes the first spot in it',
  created.status === 201 && game?.id != null && game.capacity === 3 && game.filledCount === 1,
  `POST -> ${created.status}, game ${game?.id} "${game?.title}", ${game?.filledCount}/${game?.capacity} filled`);

// -- 2. it appears in the feed anyone browses --------------------------------
{
  const feed = (await api('/solo/open-games')).json ?? [];
  const mine = feed.find((g) => g.id === game.id);
  check('the game the host posted is the game the feed shows',
    Boolean(mine) && mine.title === TITLE && Number(mine.pricePerPlayer) === 250,
    `feed has ${feed.length} game(s); "${mine?.title}" at ৳${mine?.pricePerPlayer}, ${mine?.filledCount}/${mine?.capacity} filled`);

  const filtered = (await api(`/solo/open-games?gameDate=${gameDate}`)).json ?? [];
  check('the date filter is applied by the server, not faked on screen',
    filtered.some((g) => g.id === game.id) && filtered.every((g) => g.gameDate === gameDate),
    `${filtered.length} game(s) on ${gameDate}, all matching the date`);
}

// -- 3. another player claims a spot -----------------------------------------
const joiner = await registerPlayer('joiner');
{
  const join = await api(`/solo/open-games/${game.id}/join`, {
    method: 'POST', token: joiner.token, body: { paymentMethod: 'bKash' },
  });
  const after = (await api(`/solo/open-games/${game.id}`)).json;
  const members = (await api(`/solo/open-games/${game.id}/members`)).json ?? [];
  check('joining claims a real spot and the count moves with it',
    join.status === 200 && after.filledCount === 2
      && members.some((m) => m.userId === joiner.user.id),
    `join -> ${join.status}, filled ${after?.filledCount}/${after?.capacity}, roster ${members.length}`);
  check('the roster names the player who actually joined',
    members.find((m) => m.userId === joiner.user.id)?.name === joiner.user.fullName,
    `roster entry "${members.find((m) => m.userId === joiner.user.id)?.name}"`);
}

// -- 4. the same player cannot take two spots --------------------------------
{
  const again = await api(`/solo/open-games/${game.id}/join`, {
    method: 'POST', token: joiner.token, body: { paymentMethod: 'bKash' },
  });
  const after = (await api(`/solo/open-games/${game.id}`)).json;
  check('joining twice is refused and takes no second spot',
    again.status >= 400 && after.filledCount === 2,
    `second join -> ${again.status}, still ${after?.filledCount}/${after?.capacity}`);
}

// -- 5. a signed-out visitor cannot join --------------------------------------
{
  const anon = await api(`/solo/open-games/${game.id}/join`, {
    method: 'POST', body: { paymentMethod: 'bKash' },
  });
  check('a signed-out visitor cannot claim a spot',
    anon.status === 401 || anon.status === 403,
    `anonymous join -> ${anon.status}`);
}

// -- 6. capacity is real ------------------------------------------------------
{
  const second = await registerPlayer('second');
  const fill = await api(`/solo/open-games/${game.id}/join`, {
    method: 'POST', token: second.token, body: { paymentMethod: 'bKash' },
  });
  const full = (await api(`/solo/open-games/${game.id}`)).json;

  const late = await registerPlayer('late');
  const rejected = await api(`/solo/open-games/${game.id}/join`, {
    method: 'POST', token: late.token, body: { paymentMethod: 'bKash' },
  });
  const after = (await api(`/solo/open-games/${game.id}`)).json;

  check('the last spot fills the game and flips its status',
    fill.status === 200 && full.filledCount === 3 && full.status === 'FULL',
    `filled ${full?.filledCount}/${full?.capacity}, status ${full?.status}`);
  check('a full game refuses the next player and stays at capacity',
    rejected.status >= 400 && after.filledCount === 3,
    `late join -> ${rejected.status} "${rejected.json?.message ?? ''}", still ${after?.filledCount}/${after?.capacity}`);
}

// -- 7. a reliability bar nobody could meet is the caller's mistake, not ours -
{
  const impossible = await api('/solo/open-games', {
    method: 'POST', token: host.token,
    body: {
      title: `Elite only ${Date.now() % 100000}`, venueId: venue.id, gameDate,
      startTime: '07:00:00', endTime: '08:00:00',
      skillLevel: 'ALL_LEVELS', capacity: 4, pricePerPlayer: 300, minimumReliability: 200,
    },
  });
  check('a reliability bar above the maximum is refused as a bad request',
    impossible.status === 400 && !/went wrong on our side/i.test(impossible.text),
    `minimumReliability 200 -> ${impossible.status} "${impossible.json?.message ?? impossible.text.slice(0, 80)}"`);
}

// -- 8. a game priced and capped at the edges is still accepted ---------------
{
  const edge = await api('/solo/open-games', {
    method: 'POST', token: host.token,
    body: {
      title: `Edge game ${Date.now() % 100000}`, venueId: venue.id, gameDate,
      startTime: '06:00:00', endTime: '07:00:00',
      skillLevel: 'ALL_LEVELS', capacity: 2, pricePerPlayer: 0, minimumReliability: 100,
    },
  });
  check('the highest legal reliability bar is accepted',
    edge.status === 201,
    `minimumReliability 100, free game -> ${edge.status}`);
}

// -- 9. an unknown game is not found ------------------------------------------
{
  const missing = await api('/solo/open-games/99999999');
  check('an unknown game is reported as missing rather than rendering blank',
    missing.status === 404,
    `GET /solo/open-games/99999999 -> ${missing.status}`);
}

console.log('');
if (failures.length === 0) {
  console.log(`OPEN GAMES FLOW CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`OPEN GAMES FLOW: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
