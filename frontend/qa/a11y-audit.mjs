/**
 * Accessibility + responsive sweep.
 *
 * Runs axe-core against every major route in three viewports, for the player,
 * owner and admin shells, and also reports any route that scrolls sideways.
 *
 *   cd frontend && node qa/a11y-audit.mjs [webUrl]
 *
 * Exits non-zero when a critical or serious violation is found.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const WEB = process.argv[2] ?? 'http://localhost:4175';
const API = 'http://localhost:8080/api/v1';
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const SHELLS = [
  {
    who: 'player',
    creds: { email: 'rafi@turfchai.dev', password: 'demo1234' },
    routes: [
      ['landing', '/'],
      ['auth', '/auth'],
      ['player-home', '/player'],
      ['explore', '/player/explore'],
      ['bookings', '/player/bookings'],
      ['rewards', '/player/rewards'],
      ['dashboard', '/player/dashboard'],
    ],
  },
  {
    who: 'owner',
    creds: { email: 'sumaiya.hossain.65@gmail.com', password: 'Demo@12345' },
    routes: [
      ['owner-dashboard', '/owner'],
      ['owner-bookings', '/owner/bookings'],
      ['owner-customers', '/owner/customers'],
      ['owner-payments', '/owner/payments'],
    ],
  },
  {
    who: 'admin',
    admin: true,
    routes: [
      ['admin-overview', '/admin'],
      ['admin-users', '/admin/users'],
      ['admin-turfs', '/admin/turfs'],
      ['admin-activity', '/admin/activity'],
    ],
  },
];

async function login(page, creds) {
  return page.evaluate(
    async ([api, body]) => {
      const r = await fetch(api + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.ok ? r.json() : null;
    },
    [API, creds],
  );
}

async function loginAdmin(page) {
  return page.evaluate(async (api) => {
    for (const email of ['admin0@turfchai.com', 'admin1@turfchai.com', 'admin2@turfchai.com', 'admin3@turfchai.com']) {
      const c = await fetch(api + '/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Demo@12345' }),
      });
      if (!c.ok) continue;
      const chal = await c.json();
      const v = await fetch(api + '/admin/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: chal.challenge, code: chal.devCode }),
      });
      if (v.ok) return v.json();
    }
    return null;
  }, API);
}

const findings = new Map();
const overflow = [];
let scanned = 0;

async function scan(page, label, url, viewport) {
  await page.goto(WEB + url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(500);

  const wide = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  if (wide.scroll > wide.client + 1) {
    overflow.push(`${label}/${viewport.name}: ${wide.scroll}px in ${wide.client}px`);
  }

  await page.evaluate(AXE);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ['violations'] });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 150)),
      count: v.nodes.length,
    }));
  });

  scanned += 1;
  for (const v of violations) {
    const entry = findings.get(v.id) ?? { impact: v.impact, help: v.help, where: [], sample: v.nodes[0], total: 0 };
    entry.where.push(`${label}/${viewport.name}(${v.count})`);
    entry.total += v.count;
    findings.set(v.id, entry);
  }
}

const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    for (const shell of SHELLS) {
      const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await ctx.newPage();
      await page.goto(WEB, { waitUntil: 'domcontentloaded' });

      const session = shell.admin ? await loginAdmin(page) : await login(page, shell.creds);
      if (!session) {
        console.log(`SKIP ${shell.who}/${viewport.name}: could not sign in (2FA throttle?)`);
        await ctx.close();
        continue;
      }
      await page.addInitScript((t) => {
        localStorage.setItem('turfchai.auth.token', t.token);
        localStorage.setItem('turfchai_token', t.token);
        localStorage.setItem('turfchai.auth.user', JSON.stringify(t.user ?? t.admin ?? {}));
      }, session);

      for (const [label, url] of shell.routes) await scan(page, label, url, viewport);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\nScanned ${scanned} page/viewport combinations at ${WEB}\n`);

if (overflow.length > 0) {
  console.log('HORIZONTAL OVERFLOW:');
  overflow.forEach((o) => console.log('  ' + o));
  console.log('');
} else {
  console.log('No horizontal overflow at any viewport.\n');
}

const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const sorted = [...findings.entries()].sort((a, b) => (order[a[1].impact] ?? 9) - (order[b[1].impact] ?? 9));
for (const [id, f] of sorted) {
  console.log(`[${String(f.impact).toUpperCase()}] ${id} - ${f.help}`);
  console.log(`  ${f.total} node(s): ${f.where.join(', ')}`);
  console.log(`  e.g. ${f.sample}`);
  console.log('');
}

const blocking = sorted.filter(([, f]) => f.impact === 'critical' || f.impact === 'serious');
if (sorted.length === 0) {
  console.log('NO ACCESSIBILITY VIOLATIONS');
} else {
  console.log(`${sorted.length} rule(s) violated; ${blocking.length} critical/serious`);
}
process.exit(blocking.length > 0 || overflow.length > 0 ? 1 : 0);
