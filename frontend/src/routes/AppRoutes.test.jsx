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
  it('advertises only paths that resolve to a real screen', async () => {
    // A path helper pointing at a route that does not exist is dead
    // navigation: the link renders, the click lands on "page not found".
    signIn({ role: 'SUPER_ADMIN' });

    for (const path of ALL_STATIC) {
      stubEverything();
      const { unmount } = renderApp(<AppRoutes />, { route: path });
      await waitFor(() => {
        expect(document.body.textContent).not.toMatch(/page you.re looking for/i);
      });
      unmount();
    }
  });

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
