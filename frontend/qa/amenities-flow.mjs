// Live proof that owner amenities and rules persist and reach the public page.
//   node qa/amenities-flow.mjs
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

const login = await api('/auth/login', { method: 'POST', body: OWNER });
const token = login.json.token;
const venue = (await api('/owner/venues', { token })).json[0];

// -- a venue with several amenities ----------------------------------------
const set = 'floodlights,parking,wifi';
const rules = '👟 Turf shoes only,🚭 No smoking';
await api(`/owner/venues/${venue.id}`, { method: 'PUT', token, body: { amenities: set, rules } });

const ownerView = await api(`/owner/venues/${venue.id}`, { token });
check('what the owner saved is what the owner console reads back',
  ownerView.json.amenities === set && ownerView.json.rules === rules,
  `amenities="${ownerView.json.amenities}", rules="${ownerView.json.rules}"`);

const publicView = unwrap((await api(`/venues/${venue.slug}`)).json);
check('the public venue page lists the same amenities the owner selected',
  Array.isArray(publicView.amenities)
    && publicView.amenities.join(',') === set,
  `public amenities = [${publicView.amenities}]`);

check('the public venue page lists the same house rules',
  Array.isArray(publicView.rules) && publicView.rules.length === 2,
  `public rules = [${publicView.rules}]`);

// -- a venue with none ------------------------------------------------------
await api(`/owner/venues/${venue.id}`, { method: 'PUT', token, body: { amenities: '', rules: '' } });
const cleared = unwrap((await api(`/venues/${venue.slug}`)).json);
check('clearing every amenity leaves the venue honestly empty, not defaulted',
  cleared.amenities.length === 0 && cleared.rules.length === 0,
  `amenities=${cleared.amenities.length}, rules=${cleared.rules.length}`);

const ownerCleared = await api(`/owner/venues/${venue.id}`, { token });
check('the owner console reads back the cleared state rather than hardcoded defaults',
  !ownerCleared.json.amenities && !ownerCleared.json.rules,
  `amenities="${ownerCleared.json.amenities}", rules="${ownerCleared.json.rules}"`);

// -- one amenity ------------------------------------------------------------
await api(`/owner/venues/${venue.id}`, { method: 'PUT', token, body: { amenities: 'parking', rules: '' } });
const single = unwrap((await api(`/venues/${venue.slug}`)).json);
check('a single amenity round-trips exactly',
  single.amenities.length === 1 && single.amenities[0] === 'parking',
  `public amenities = [${single.amenities}]`);

// restore something sensible for the rest of the suite
await api(`/owner/venues/${venue.id}`, { method: 'PUT', token, body: { amenities: set, rules } });

console.log('');
if (failures.length === 0) {
  console.log(`AMENITIES FLOW CLEAN — ${pass} checks`);
  process.exit(0);
}
console.log(`AMENITIES FLOW: ${failures.length} failure(s) out of ${pass + failures.length}`);
for (const f of failures) console.log(`  - ${f.step}\n      ${f.evidence}`);
process.exit(1);
