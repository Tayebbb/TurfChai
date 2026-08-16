import { Navigate, useLocation } from 'react-router-dom';
import { RouteFallback } from '@/components/common/RouteFallback';
import { useSession } from '@/hooks/useSession';
import { paths } from '@/routes/paths';

/**
 * Route guard for every screen that only makes sense with an identity.
 *
 * The API is authoritative — it is what actually refuses the data — but the
 * shell must not render a personalised screen for an anonymous visitor, and a
 * locally-forged `localStorage` "session" must not be enough to reach an owner
 * or host workspace. So the role checked here is the one the *server* reported
 * for the stored token, never the one the browser cached.
 *
 * That answer comes from `SessionProvider`, which already fetches it once per
 * token. Calling `GET /me` again here made every guarded navigation issue two
 * identity requests.
 *
 * `roles` is optional: omit it to require only that the caller is signed in.
 */
export default function RequireAuth({ children, roles }) {
  const location = useLocation();
  const { signedIn, role, loading, error } = useSession();

  if (!signedIn) return <SignInRedirect location={location} />;
  if (loading) return <RouteFallback />;

  // The token was rejected; `client.js` has already cleared the session.
  if (error) return <SignInRedirect location={location} />;

  if (roles && !roles.includes(role)) {
    // Signed in, wrong workspace: send them somewhere they are allowed to be
    // rather than to a sign-in page they have already satisfied.
    return <Navigate to={paths.player.home} replace />;
  }

  return children;
}

function SignInRedirect({ location }) {
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`${paths.auth}?next=${encodeURIComponent(next)}`} replace />;
}
