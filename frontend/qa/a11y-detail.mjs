/**
 * Detail for the rules a11y-audit.mjs reports, with the computed colours and
 * selectors needed to fix them.
 *
 *   cd frontend && node qa/a11y-detail.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const WEB = process.argv[2] ?? 'http://localhost:4175';
const API = 'http://localhost:8080/api/v1';
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const RULES = ['color-contrast', 'scrollable-region-focusable', 'heading-order'];

const TARGETS = [
  ['player', { email: 'rafi@turfchai.dev', password: 'demo1234' }, [['rewards', '/player/rewards']]],
  [
    'owner',
    { email: 'sumaiya.hossain.65@gmail.com', password: 'Demo@12345' },
    [
      ['owner-dashboard', '/owner'],
      ['owner-bookings', '/owner/bookings'],
      ['owner-customers', '/owner/customers'],
      ['owner-payments', '/owner/payments'],
    ],
  ],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(WEB, { waitUntil: 'domcontentloaded' });

for (const [who, creds, routes] of TARGETS) {
  const session = await page.evaluate(
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
  if (!session) {
    console.log(`SKIP ${who}: sign-in failed`);
    continue;
  }
  await page.addInitScript((t) => {
    localStorage.setItem('turfchai.auth.token', t.token);
    localStorage.setItem('turfchai_token', t.token);
    localStorage.setItem('turfchai.auth.user', JSON.stringify(t.user ?? {}));
  }, session);

  for (const [label, url] of routes) {
    await page.goto(WEB + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.evaluate(AXE);
    const detail = await page.evaluate(async (rules) => {
      const res = await window.axe.run(document, { runOnly: rules, resultTypes: ['violations'] });
      return res.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          rule: v.id,
          target: n.target.join(' '),
          html: n.html.slice(0, 130),
          why: (n.any[0]?.message ?? n.all[0]?.message ?? '').slice(0, 200),
          data: n.any[0]?.data
            ? {
                fg: n.any[0].data.fgColor,
                bg: n.any[0].data.bgColor,
                ratio: n.any[0].data.contrastRatio,
                expected: n.any[0].data.expectedContrastRatio,
                size: n.any[0].data.fontSize,
                weight: n.any[0].data.fontWeight,
              }
            : null,
        })),
      );
    }, rules => rules, RULES).catch(() => []);
    const rows = await page.evaluate(async (rules) => {
      const res = await window.axe.run(document, { runOnly: rules, resultTypes: ['violations'] });
      return res.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          rule: v.id,
          target: n.target.join(' '),
          html: n.html.slice(0, 130),
          data: n.any[0]?.data ?? null,
        })),
      );
    }, RULES);
    if (rows.length === 0) continue;
    console.log(`\n=== ${label} (${url}) ===`);
    for (const r of rows) {
      console.log(`  [${r.rule}] ${r.target}`);
      console.log(`    ${r.html}`);
      if (r.data && r.data.fgColor) {
        console.log(
          `    fg=${r.data.fgColor} bg=${r.data.bgColor} ratio=${r.data.contrastRatio} need=${r.data.expectedContrastRatio} size=${r.data.fontSize} weight=${r.data.fontWeight}`,
        );
      }
    }
  }
}

await browser.close();
