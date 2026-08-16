import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '@/routes/AppRoutes';
import { paths } from '@/routes/paths';
import { renderApp, signIn } from '@/test/testUtils';

/** Every static URL the app advertises, flattened out of `paths`. */
function staticPaths(node, out = []) {
  for (const value of Object.values(node)) {
    if (typeof value === 'string' && value.startsWith('/')) out.push(value);
    else if (value && typeof value === 'object') staticPaths(value, out);
  }
  return out;
}

const ALL_STATIC = [...new Set(staticPaths(paths))];

function stubEverything() {
  globalThis.fetch.mockImplementation(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => [],
    text: async () => '[]',
  }));
}

describe('route table', () => {
  // Every advertised path is walked in one test, and each one downloads a lazy
  // chunk, so the default per-test budget is not enough when the whole suite is
  // running in parallel.
  it('advertises only paths that resolve to a real screen', async () => {
    // A path helper pointing at a route that does not exist is dead
    // navigation: the link renders, the click lands on "page not found".
    signIn({ role: 'SUPER_ADMIN' });

    for (const path of ALL_STATIC) {
      stubEverything();
      const { unmount } = renderApp(<AppRoutes />, { route: path });
      // The Suspense skeleton carries none of the not-found wording, so
      // asserting before it clears would pass without loading the screen.
      await waitFor(
        () => {
          expect(document.querySelector('.route-fallback')).toBeNull();
        },
        { timeout: 5000 },
      );
      expect(document.body.textContent, `${path} resolves to the not-found screen`)
        .not.toMatch(/page you.re looking for/i);
      unmount();
    }
  }, 120_000);

  it('sends an anonymous visitor from a private route to sign-in, not to a crash', async () => {
    stubEverything();

    renderApp(<AppRoutes />, { route: paths.player.bookings });

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/sign in|welcome back/i);
    });
  });

  it('keeps the public catalogue reachable while signed out', async () => {
    stubEverything();

    renderApp(<AppRoutes />, { route: paths.player.explore });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /explore venues/i })).toBeInTheDocument();
    });
  });

  it('renders an unknown URL as the not-found screen', async () => {
    stubEverything();

    renderApp(<AppRoutes />, { route: '/this-route-does-not-exist' });

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/page you.re looking for|not found/i);
    });
  });
});
