/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '@/api/auth';
import { getToken, getUser, setSession } from '@/api/client';
import { useApi } from '@/hooks/useApi';

export const SessionContext = createContext(null);

/**
 * Owns "who is signed in" for the whole app.
 *
 * Before this existed, seven components each called the profile endpoint
 * through their own `useApi`, so a single navigation issued four identical
 * requests. Deduplicating at the request layer would have hidden the real
 * problem: there was no shared notion of the current user, so every screen had
 * to go and ask.
 *
 * It reads `GET /me` rather than `/players/me` because that is the response
 * the route guards need — it carries the account role the server recognises,
 * so `RequireAuth` and `RequireAdmin` can trust this instead of each issuing a
 * second identity request per navigation. Player *preferences* live on
 * `/players/me` and are fetched by the two screens that actually edit them.
 *
 * The fetch is keyed on the token, so signing in or out re-runs it exactly
 * once rather than leaving stale identity on screen.
 */
export function SessionProvider({ children }) {
  const [token, setToken] = useState(() => getToken());

  useEffect(() => {
    const sync = () => setToken(getToken());
    window.addEventListener('turfchai:session-change', sync);
    // Another tab signing out must not leave this one looking signed in.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('turfchai:session-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const profile = useApi(() => (token ? getMe() : Promise.resolve(null)), [token]);

  // Keep the cached copy in step so no screen renders a role the server has
  // since revoked. Done in an effect: this must not run during render.
  useEffect(() => {
    if (profile.data) setSession({ user: profile.data });
  }, [profile.data]);

  const value = useMemo(() => {
    const cached = token ? getUser() : null;
    const merged = profile.data ? { ...cached, ...profile.data } : cached;
    return {
      signedIn: Boolean(token),
      // `profile` is the server's answer; `cached` is what the login response
      // stored. Merging means a screen has a name to show immediately after
      // sign-in instead of flashing a placeholder.
      user: merged,
      // The server's role, not the browser's cached guess.
      role: profile.data?.role ?? cached?.role ?? null,
      loading: Boolean(token) && profile.loading,
      error: profile.error,
      reload: profile.reload,
    };
  }, [token, profile.data, profile.loading, profile.error, profile.reload]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
