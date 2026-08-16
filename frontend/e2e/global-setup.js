import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { API, WEB, ACCOUNTS, adminLogin, api, findSeededAccounts, login } from './support/api.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// Deliberately outside `outputDir`, which Playwright empties before every run.
export const STATE_FILE = resolve(HERE, '.state/e2e-state.json');

async function waitFor(label, probe, { attempts = 40, delayMs = 3000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await probe()) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `${label} did not become ready. Start the stack first — see qa/run-qa.ps1 or README "Running the tests".`,
  );
}

/** A previously issued session, if it is still accepted by the API. */
async function reusableSession(role, probePath) {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const cached = JSON.parse(readFileSync(STATE_FILE, 'utf8'))?.roles?.[role];
    if (!cached?.token) return null;
    const res = await api.get(probePath, cached.token);
    return res.status === 200 ? cached : null;
  } catch {
    return null;
  }
}

/**
 * Admin sign-in burns a one-time code, and the backend allows only five per
 * fifteen minutes per account. Re-challenging on every run would make the suite
 * unrunnable several times in a row, so a still-valid session is reused and,
 * failing that, the other seeded admin accounts are tried in turn.
 */
async function adminSession(role, emails) {
  const cached = await reusableSession(role, '/admin/admins');
  if (cached) return cached;

  const failures = [];
  for (const email of emails) {
    try {
      return await adminLogin(email, ACCOUNTS.demoPassword);
    } catch (error) {
      failures.push(`${email}: ${error.message}`);
    }
  }
  throw new Error(
    `Could not obtain an ${role} session. The 2FA code allowance is five per 15 minutes per ` +
      `account, so this usually clears on its own.\n  ${failures.join('\n  ')}`,
  );
}

/**
 * Resolves one account per role and records enough seeded state for the specs
 * to be deterministic without each of them re-discovering it.
 */
export default async function globalSetup() {
  await waitFor(`API at ${API}`, async () => {
    const res = await api.get('/venues?page=0&size=1');
    return res.status === 200;
  });

  await waitFor(`web app at ${WEB}`, async () => {
    const res = await fetch(WEB);
    return res.ok;
  });

  const playerA = await login(ACCOUNTS.playerA.email, ACCOUNTS.playerA.password);

  const seeded = await findSeededAccounts([
    { role: 'PLAYER', count: 1 },
    { role: 'OWNER', count: 6 },
    { role: 'HOST', count: 1 },
  ]);

  if (!seeded.PLAYER?.length) throw new Error('No seeded PLAYER found — is the demo seeder disabled?');
  if ((seeded.OWNER?.length ?? 0) < 2) throw new Error('Need at least two seeded OWNERs for tenant-isolation specs.');

  // Prefer owners that actually have bookings so the isolation specs assert
  // against real rows instead of silently passing on empty lists.
  const withBookings = [];
  const withoutBookings = [];
  for (const owner of seeded.OWNER) {
    const res = await api.get('/owner/bookings', owner.token);
    ((res.ok && Array.isArray(res.data) && res.data.length > 0) ? withBookings : withoutBookings).push(owner);
  }
  const owners = [...withBookings, ...withoutBookings];

  const admin = await adminSession('admin', [
    'admin0@turfchai.com',
    'admin1@turfchai.com',
    'admin2@turfchai.com',
    'admin3@turfchai.com',
  ]);

  // Super-admin-only behaviour is asserted in the backend suite, where it costs
  // no one-time codes. Here it is a bonus, so a throttled account must not take
  // the whole run down with it.
  let superAdmin = null;
  try {
    superAdmin = await adminSession('superAdmin', [
      'fazle.rabbi.mugdho@gmail.com',
      'superadmin@turfchai.com',
    ]);
  } catch (error) {
    console.warn(`[e2e] continuing without a super-admin session — ${error.message}`);
  }

  const state = {
    api: API,
    web: WEB,
    roles: {
      playerA: { ...playerA, email: ACCOUNTS.playerA.email },
      playerB: seeded.PLAYER[0],
      ownerA: owners[0],
      ownerB: owners[1],
      host: seeded.HOST?.[0] ?? null,
      admin,
      superAdmin,
    },
  };

  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  const names = Object.entries(state.roles)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v.user?.role ?? '?'}`)
    .join('  ');
  console.log(`[e2e] stack ready — ${names}`);
}
