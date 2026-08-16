import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

const TOKEN_KEY = 'turfchai.auth.token';
const USER_KEY = 'turfchai.auth.user';

/** Puts a signed-in session in localStorage before a component mounts. */
export function signIn(user = {}) {
  const stored = { id: 1, publicId: 'p-1', fullName: 'Test Player', role: 'PLAYER', ...user };
  localStorage.setItem(TOKEN_KEY, 'test-token');
  localStorage.setItem(USER_KEY, JSON.stringify(stored));
  return stored;
}

/**
 * Routes fetch calls by URL substring.
 *
 * @param {Array<[string, {status?: number, body?: unknown}]>} routes
 */
export function mockApi(routes) {
  const handler = vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const match = routes.find(([fragment]) => url.includes(fragment));
    if (!match) {
      throw new Error(`No mock registered for ${url}`);
    }
    const { status = 200, body = null } = match[1];
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
  globalThis.fetch.mockImplementation(handler);
  return handler;
}

/** Renders inside the providers the app actually mounts. */
export function renderApp(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <ToastProvider>
          <SessionProvider>{ui}</SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

/**
 * Mounts a page under a route pattern so `useParams()` resolves.
 *
 * Rendering a param'd page directly leaves every id `undefined`, which silently
 * turns its data calls into requests for "undefined" and makes the test look
 * like an empty-state test.
 */
export function renderRoute(ui, { path, route }) {
  return renderApp(<Routes><Route path={path} element={ui} /></Routes>, { route });
}
