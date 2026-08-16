// Interaction crawler.
//
// For every route a role can reach, finds every interactive element and clicks
// it, then decides whether anything actually happened: a navigation, an API
// call, a DOM change, or a dialog/toast. An enabled control that produces none
// of those is a dead control.
//
//   node qa/interaction-crawl.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.E2E_WEB_URL || 'http://localhost:4173';
const API = 'http://localhost:8080/api/v1';
const DEMO_PW = 'Demo@12345';

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
async function login(email, password) {
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

// Irreversible or state-destroying actions. They are reported, never auto-clicked,
// so they show up explicitly instead of vanishing from the inventory.
const DESTRUCTIVE = /cancel booking|delete|remove|suspend|reject|approve|revoke|settle|retire|withdraw|sign out|log ?out|regenerate|reset|block|flag|pay balance|confirm booking|deposit|checkout|publish|go live/i;

// Controls whose whole job is local UI state; a DOM change is success, and
// re-selecting the option already active is legitimately a no-op.
const LOCAL_ONLY = /theme|menu|close|dismiss|filter|sort|tab|show|hide|toggle|more|less|next|prev|copy|expand|collapse|^all\b|view$|^year|export|download/i;

const findings = [];
const inventory = [];

function record(role, route, label, kind, verdict, detail) {
  inventory.push({ role, route, label, kind, verdict, detail });
  if (verdict === 'DEAD') findings.push({ role, route, label, kind, detail });
}

async function crawlRoute(context, role, route) {
  // A single wedged page must not stall the whole crawl.
  const DEADLINE = Date.now() + 90_000;
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const apiCalls = [];
  page.on('response', (r) => { if (r.url().includes('/api/')) apiCalls.push(r.status()); });

  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2200);
    // Client-side CSV/ICS exports never touch the network, so count a created
    // object URL as a real action instead of inferring it from the label.
    await page.evaluate(() => {
      window.__downloads = 0;
      const orig = URL.createObjectURL;
      URL.createObjectURL = function (blob) { window.__downloads += 1; return orig.call(this, blob); };
    });
  } catch {
    await page.close();
    return;
  }

  const selector = 'main button, main a[href], main [role="tab"], main [role="switch"], '
    + 'main input[type="checkbox"], main input[type="radio"], main select, main summary';
  const count = await page.locator(selector).count();

  // One evaluate per element instead of five round-trips. The toast host is
  // cleared first so a message left by the previous control is never credited
  // to this one.
  const snapshot = () => page.evaluate(() => ({
    url: location.href,
    html: document.body.innerHTML.length,
    dialogs: document.querySelectorAll('[role=dialog]').length,
    text: document.body.innerText.length,
    selected: [...document.querySelectorAll('[aria-selected],[aria-checked],[aria-pressed]')]
      .map((n) => `${n.getAttribute('aria-selected')}${n.getAttribute('aria-checked')}${n.getAttribute('aria-pressed')}`)
      .join('|'),
    checked: [...document.querySelectorAll('input')].map((n) => (n.checked ? 1 : 0)).join(''),
    values: [...document.querySelectorAll('select')].map((n) => n.value).join('|'),
    downloads: window.__downloads ?? 0,
    toast: document.querySelector('.toast-host')?.innerText?.trim() || '',
  })).catch(() => null);

  const clearToast = () => page.evaluate(() => {
    const host = document.querySelector('.toast-host');
    if (host) host.innerHTML = '';
  }).catch(() => {});

  let clicked = 0;
  for (let i = 0; i < Math.min(count, 30); i += 1) {
    if (Date.now() > DEADLINE) { console.log(`  ${route} — deadline reached after ${i} of ${count}`); break; }
    const el = page.locator(selector).nth(i);
    let label = '';
    let disabled = false;
    let tag = '';
    let href = null;
    try {
      const info = await el.evaluate((n) => ({
        text: (n.innerText || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        tag: n.tagName.toLowerCase(),
        href: n.getAttribute('href'),
        disabled: n.disabled === true || n.getAttribute('aria-disabled') === 'true',
      }));
      label = info.text; tag = info.tag; href = info.href; disabled = info.disabled;
    } catch { continue; }
    if (!label) label = `<${tag}#${i}>`;

    if (disabled) { record(role, route, label, tag, 'DISABLED', 'honestly unavailable'); continue; }
    if (DESTRUCTIVE.test(label)) { record(role, route, label, tag, 'SKIPPED-DESTRUCTIVE', 'reported, not auto-clicked'); continue; }
    if (tag === 'a' && href && !href.startsWith('#')) { record(role, route, label, tag, 'LINK', href); continue; }

    const before = await snapshot();
    if (!before) break;
    const callsBefore = apiCalls.length;
    await clearToast();

    try {
      if (tag === 'select') {
        // Clicking a select only opens the native popup; choosing a different
        // option is what actually exercises it.
        const options = await el.evaluate((n) => [...n.options].map((o) => o.value));
        const current = await el.inputValue();
        const next = options.find((v) => v !== current);
        if (next === undefined) { record(role, route, label, tag, 'LOCAL NO-OP', 'select has a single option'); continue; }
        await el.selectOption(next, { timeout: 3000 });
      } else {
        await el.click({ timeout: 3000 });
      }
    } catch {
      record(role, route, label, tag, 'UNCLICKABLE', 'enabled but click timed out (covered or animating)');
      continue;
    }
    clicked += 1;
    await page.waitForTimeout(550);

    const after = await snapshot();
    if (!after) break;

    const navigated = before.url !== after.url;
    const calledApi = apiCalls.length > callsBefore;
    const stateChanged = before.selected !== after.selected
      || before.checked !== after.checked
      || before.values !== after.values;
    const domChanged = before.html !== after.html || before.dialogs !== after.dialogs || before.text !== after.text;
    const toasted = Boolean(after.toast);

    let verdict;
    let detail = '';
    if (navigated) { verdict = 'NAVIGATED'; detail = after.url.replace(BASE, ''); }
    else if (calledApi) { verdict = 'CALLED API'; detail = `${apiCalls.length - callsBefore} request(s)`; }
    else if (after.downloads > before.downloads) { verdict = 'DOWNLOADED'; detail = 'produced a file'; }
    else if (stateChanged) { verdict = 'STATE CHANGED'; detail = 'selection/value updated'; }
    else if (domChanged) { verdict = 'UI CHANGED'; detail = toasted ? `toast: ${after.toast.slice(0, 60)}` : 'rendered a change'; }
    else if (toasted && !LOCAL_ONLY.test(label)) { verdict = 'DEAD'; detail = `toast only: ${after.toast.slice(0, 60)}`; }
    else if (LOCAL_ONLY.test(label)) { verdict = 'LOCAL NO-OP'; detail = 'local control, already in that state'; }
    else { verdict = 'DEAD'; detail = 'no navigation, no request, no UI change, no message'; }

    record(role, route, label, tag, verdict, detail);

    // Only reset when the click actually moved us or opened something modal.
    if (navigated || after.dialogs > before.dialogs) {
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1100);
      } catch { break; }
    }
  }
  console.log(`  ${route} — ${clicked} clicked of ${count} controls`);
  await page.close();
}

async function makeContext(browser, session) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (session) {
    await context.addInitScript(([token, user]) => {
      try {
        localStorage.setItem('turfchai.auth.token', token);
        localStorage.setItem('turfchai.auth.user', user);
      } catch { /* about:blank */ }
    }, [session.token, JSON.stringify(session.user ?? {})]);
  }
  return context;
}

const playerA = await login('rafi@turfchai.dev', 'demo1234');
const admin = await adminLogin();
let ownerA = null;
if (admin) {
  const r = await api('/admin/users?page=0&size=60&role=OWNER', { token: admin.token });
  for (const u of r.json?.data?.items ?? []) {
    const c = await login(u.email, DEMO_PW);
    if (!c) continue;
    const v = await api('/owner/venues', { token: c.token });
    if (Array.isArray(v.json) && v.json.length > 0) { ownerA = c; break; }
  }
}
const venues = await api('/venues?page=0&size=1');
const venueSlug = venues.json?.items?.[0]?.slug ?? 'kick-off-arena';

const ROUTES = {
  anonymous: [null, ['/', '/auth', '/player', '/player/explore', `/player/venues/${venueSlug}`, '/solo/open-games', '/owner/onboarding']],
  playerA: [playerA, ['/player', '/player/explore', '/player/bookings', '/player/rewards', '/player/matchday',
    '/player/dashboard', '/player/dashboard/settings', '/player/dashboard/wallet', '/player/dashboard/stats',
    '/player/dashboard/tournaments', '/player/dashboard/venues', '/solo/open-games', '/solo/alerts',
    '/player/tournaments/TR-CUP-0091', '/host/tournament', '/host/multi-pitch', '/host/reserve']],
  ownerA: [ownerA, ['/owner', '/owner/calendar', '/owner/bookings', '/owner/payments', '/owner/venue-setup',
    '/owner/customers', '/owner/promotions', '/owner/reviews', '/owner/staff']],
  admin: [admin ? { token: admin.token, user: admin.user ?? {} } : null,
    ['/admin', '/admin/turfs', '/admin/users', '/admin/turf-requests', '/admin/payouts',
      '/admin/activity', '/admin/admins', '/admin/profile', '/admin/users/growth', '/admin/users/segments']],
};

const browser = await chromium.launch();
for (const [role, [session, routes]] of Object.entries(ROUTES)) {
  if (role !== 'anonymous' && !session) { console.log(`skipping ${role}: no session`); continue; }
  const context = await makeContext(browser, session);
  console.log(`clicking through ${role} (${routes.length} routes)...`);
  for (const route of routes) await crawlRoute(context, role, route);
  await context.close();
}
await browser.close();

const byVerdict = inventory.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] ?? 0) + 1; return acc; }, {});
console.log('');
console.log('=== INTERACTION INVENTORY ===');
for (const [v, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${v}`);
console.log(`  ${String(inventory.length).padStart(4)}  TOTAL controls exercised`);

if (findings.length > 0) {
  console.log('');
  console.log('=== DEAD CONTROLS ===');
  for (const f of findings) console.log(`  ${f.role.padEnd(10)} ${f.route.padEnd(34)} "${f.label}"  ${f.detail}`);
}
console.log('');
console.log(findings.length === 0
  ? `INTERACTION CRAWL CLEAN — ${inventory.length} controls, 0 dead`
  : `INTERACTION CRAWL: ${findings.length} dead control(s) out of ${inventory.length}`);
process.exit(findings.length === 0 ? 0 : 1);
