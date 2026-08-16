import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base, expect } from '@playwright/test';

import { api, unwrap } from './api.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(HERE, '../.state/e2e-state.json');

export const state = () => JSON.parse(readFileSync(STATE_FILE, 'utf8'));

const TOKEN_KEY = 'turfchai.auth.token';
const USER_KEY = 'turfchai.auth.user';
const LEGACY_TOKEN_KEY = 'turfchai_token';
const LEGACY_USER_KEY = 'turfchai_user';

/** Third-party origins the app links to but does not control. */
const EXTERNAL_NOISE = ['fonts.gstatic.com', 'fonts.googleapis.com', 'favicon'];

/**
 * Collects everything a real user would report as "it's broken" but which a
 * passing assertion can still hide: uncaught exceptions, console errors, and
 * requests the app fired that the server rejected.
 */
export class Diagnostics {
  constructor(page) {
    this.pageErrors = [];
    this.consoleErrors = [];
    this.failedRequests = [];

    page.on('pageerror', (error) => this.pageErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const location = msg.location?.()?.url ?? '';
        this.consoleErrors.push({ text: msg.text(), url: location });
      }
    });
    page.on('requestfailed', (req) => {
      this.failedRequests.push({ status: 'aborted', url: req.url(), reason: req.failure()?.errorText });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) this.failedRequests.push({ status: res.status(), url: res.url() });
    });
  }

  /** Failures against our own API, ignoring noise from unrelated origins. */
  apiFailures({ ignore = [] } = {}) {
    return this.failedRequests.filter(
      (f) => f.url.includes('/api/') && !ignore.some((pattern) => f.url.includes(pattern)),
    );
  }

  /**
   * Console errors the application is responsible for.
   *
   * Generic "Failed to load resource" lines are dropped because every one of
   * them is already mirrored by a request event, which {@link apiFailures}
   * checks precisely and by origin. Keeping both would fail the suite in any
   * sandbox without outbound internet, for reasons unrelated to the code.
   */
  appConsoleErrors() {
    return this.consoleErrors.filter(
      ({ text, url }) =>
        !/^Failed to load resource/i.test(text) &&
        !EXTERNAL_NOISE.some((n) => url.includes(n) || text.includes(n)),
    );
  }

  summary() {
    return {
      pageErrors: this.pageErrors,
      consoleErrors: this.consoleErrors,
      failedRequests: this.failedRequests,
    };
  }
}

async function signInAs(page, role) {
  const session = state().roles[role];
  if (!session) throw new Error(`No seeded session for role "${role}"`);

  await page.goto('/');
  await page.evaluate(
    ({ token, user, keys }) => {
      localStorage.setItem(keys.token, token);
      localStorage.setItem(keys.user, JSON.stringify(user));
      localStorage.setItem(keys.legacyToken, token);
      localStorage.setItem(keys.legacyUser, JSON.stringify(user));
    },
    {
      token: session.token,
      user: session.user,
      keys: {
        token: TOKEN_KEY,
        user: USER_KEY,
        legacyToken: LEGACY_TOKEN_KEY,
        legacyUser: LEGACY_USER_KEY,
      },
    },
  );
  return session;
}

export const test = base.extend({
  diagnostics: async ({ page }, use) => {
    await use(new Diagnostics(page));
  },

  /** Signs the page in as any seeded role: `await as('ownerA')`. */
  as: async ({ page }, use) => {
    await use((role) => signInAs(page, role));
  },

  /** Talks to the backend directly, to assert what actually landed in the database. */
  backend: async ({}, use) => {
    await use({
      ...api,
      unwrap,
      token: (role) => state().roles[role].token,
      user: (role) => state().roles[role].user,
    });
  },
});

export { expect };

/** Signs in through the real form rather than by injecting a token. */
export async function signInThroughUi(page, email, password) {
  await page.goto('/auth');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  // This app animates a decorative layer forever, so a normal click can wait
  // for "stable" indefinitely; submitting the form directly is equivalent.
  await page.evaluate(() => document.querySelector('form').requestSubmit());
}

/** The first slot on a date that the API says is genuinely bookable. */
export async function findBookableSlot(token, { daysAhead = 1 } = {}) {
  const date = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
  const venues = await api.get('/venues?page=0&size=50', token);
  for (const venue of venues.data.items ?? []) {
    const slots = await api.get(`/venues/${venue.id}/slots?date=${date}`, token);
    if (!slots.ok || !Array.isArray(slots.data)) continue;
    const slot = slots.data.find((s) => s.status === 'AVAILABLE' && s.bookable);
    if (slot) return { venue, slot, date };
  }
  throw new Error(`No bookable slot found on ${date}`);
}
