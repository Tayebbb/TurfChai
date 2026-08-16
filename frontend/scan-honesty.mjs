// Agent D - frontend honesty gate.
// Finds the defect class fixed in Phase 13: a catch block that hides a failure
// from the user, especially one followed by a success message that runs anyway
// (VenueSetupPage.saveDepositSection, OwnerOnboardingPage uploads,
// UsersPage.handleSuspendQuick). Reviewed, deliberate degradations are listed in
// ACCEPTED with the reason they are safe, so this fails only on NEW ones.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('./src/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');

// path -> why a silent catch is correct there.
const ACCEPTED = new Map([
  ['src/api/client.js', 'response body parse guards; the HTTP status carries the meaning'],
  ['src/components/chat/ChatWidget.jsx', 'clearing the transcript locally is the whole user intent'],
  ['src/components/common/LocationPicker.jsx', 'reverse-geocoded label is cosmetic; coordinates are already captured'],
  ['src/context/ThemeContext.jsx', 'blocked localStorage still leaves a working in-memory theme'],
  ['src/hooks/useSpeechRecognition.js', 'start() throws when already running; the session is live either way'],
  ['src/pages/admin/PayoutsPage.jsx', 'drawer enrichment only; the row already carries what the admin acts on'],
  ['src/pages/admin/ProfilePage.jsx', 'falls back to the stored session user rather than blanking the page'],
  ['src/pages/player/ExplorePage.jsx', 'bookmark hydration; hearts simply render unset'],
  ['src/pages/player/VenuePage.jsx', 'bookmark hydration; the write path reports its own failures'],
  ['src/pages/owner/VenueSetupPage.jsx', 'optional secondary lists; the primary load reports failure via loadError'],
  ['src/utils/deviceActions.js', 'user dismissing a share sheet is not a failure'],
  ['src/pages/owner/DashboardPage.jsx', 'JSON.parse guard on a stored photo blob; empty list is the correct fallback'],
  ['src/pages/owner/CalendarPage.jsx', 'venue-list catch only stops the spinner; the day load reports via calendarError'],
  ['src/pages/player/CheckoutPage.jsx', 'public slot preview only; the hold and the pay button report their own failures'],
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// A catch "surfaces" the failure if it tells the user, re-raises, forwards the
// error into state, or aborts the operation instead of completing it.
const SURFACES = /showToast|handleApiError|set\w*Error|setFailed|toUserMessage|throw\b|reject\(|\berror\b/i;
const ABORTS = /\b(return|continue|break)\b/;
const CLAIMS = /showToast\(\s*[`'"][^`'"]*(saved|updated|created|sent|added|removed|deleted|applied|confirmed|success|uploaded|suspended)/i;

const findings = [];
for (const file of walk(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  let idx = 0;
  while ((idx = src.indexOf('catch', idx)) !== -1) {
    const open = src.indexOf('{', idx);
    if (open === -1) break;
    const close = matchBrace(src, open);
    if (close === -1) break;
    const body = src.slice(open + 1, close);
    const line = src.slice(0, idx).split('\n').length;
    idx = close;

    if (SURFACES.test(body) || ABORTS.test(body)) continue;
    if (ACCEPTED.has(rel)) continue;

    const kind = CLAIMS.test(src.slice(close, close + 900)) ? 'FAKE SUCCESS' : 'SILENT FAILURE';
    findings.push({ rel, line, kind, body: body.trim().replace(/\s+/g, ' ').slice(0, 80) });
  }
}

for (const f of findings) console.log(`${f.kind}  ${f.rel}:${f.line}  ${f.body}`);
console.log(findings.length === 0
  ? `AGENT D: clean (${ACCEPTED.size} reviewed degradations allowlisted)`
  : `\nAGENT D: ${findings.length} unreviewed silent failure(s)`);
process.exit(findings.length === 0 ? 0 : 1);
