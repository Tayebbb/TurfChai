import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RequireAuth from '@/guards/RequireAuth';
import { useSession } from '@/hooks/useSession';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

function SessionProbe({ label }) {
  const { signedIn, user, loading } = useSession();
  return (
    <div>
      <span data-testid={`${label}-signed-in`}>{String(signedIn)}</span>
      <span data-testid={`${label}-loading`}>{String(loading)}</span>
      <span data-testid={`${label}-name`}>{user?.fullName ?? ''}</span>
    </div>
  );
}

/** Requests that answer "who is the caller", however they are spelled. */
function countIdentityCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([input]) => /\/(players\/)?me(\?|$)/.test(String(input))).length;
}

const ME = ['/api/v1/me', { body: { id: 2, fullName: 'Rafi Ahmed', role: 'PLAYER' } }];

/**
 * TC-016: seven components each fetched the profile through their own
 * `useApi`, so one navigation issued four identical requests. The fix is a
 * single owner of session state, not request-level deduplication.
 *
 * TC-023: the route guards then added a second identity endpoint on top, so
 * every guarded navigation asked twice.
 */
describe('SessionProvider (TC-016)', () => {
  it('fetches the identity once no matter how many components read it', async () => {
    signIn();
    const fetchMock = mockApi([ME]);

    renderApp(
      <>
        <SessionProbe label="a" />
        <SessionProbe label="b" />
        <SessionProbe label="c" />
        <SessionProbe label="d" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('a-name')).toHaveTextContent('Rafi Ahmed');
    });
    expect(countIdentityCalls(fetchMock)).toBe(1);
  });

  it('shares one identity across every consumer', async () => {
    signIn();
    mockApi([ME]);

    renderApp(
      <>
        <SessionProbe label="a" />
        <SessionProbe label="b" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('b-name')).toHaveTextContent('Rafi Ahmed');
    });
    expect(screen.getByTestId('a-name')).toHaveTextContent('Rafi Ahmed');
  });

  it('a guarded route adds no second identity request (TC-023)', async () => {
    signIn({ role: 'PLAYER' });
    const fetchMock = mockApi([ME]);

    renderApp(
      <RequireAuth roles={['PLAYER']}>
        <SessionProbe label="guarded" />
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('guarded-name')).toHaveTextContent('Rafi Ahmed');
    });
    expect(countIdentityCalls(fetchMock)).toBe(1);
  });

  it('keeps a guarded route out when the server reports another role', async () => {
    // The browser claims to be an owner; the server says PLAYER and wins.
    signIn({ role: 'OWNER' });
    mockApi([ME]);

    renderApp(
      <RequireAuth roles={['OWNER']}>
        <SessionProbe label="owner" />
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('owner-name')).not.toBeInTheDocument();
    });
  });

  it('makes no identity request at all when signed out (TC-022)', async () => {
    const fetchMock = mockApi([ME]);

    renderApp(<SessionProbe label="anon" />);

    await waitFor(() => {
      expect(screen.getByTestId('anon-loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('anon-signed-in')).toHaveTextContent('false');
    expect(countIdentityCalls(fetchMock)).toBe(0);
  });

  it('surfaces a failed identity load instead of hanging on loading', async () => {
    signIn();
    mockApi([['/api/v1/me', { status: 500, body: {} }]]);

    function ErrorProbe() {
      const { error, loading } = useSession();
      return (
        <span data-testid="state">{loading ? 'loading' : error ? 'error' : 'ok'}</span>
      );
    }

    renderApp(<ErrorProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('error');
    });
  });
});
