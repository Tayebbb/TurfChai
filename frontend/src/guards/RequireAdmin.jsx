import { Navigate, useLocation } from 'react-router-dom';
import { RouteFallback } from '@/components/common/RouteFallback';
import { useSession } from '@/hooks/useSession';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Guards the admin console. The API is already protected server-side, but the
 * console shell must not render for anonymous visitors, and a locally-spoofed
 * "session" must not reach it either — the role compared here is the one the
 * server reported for the stored token.
 *
 * The identity comes from `SessionProvider` rather than a second `GET /me`,
 * which is what every admin navigation used to cost.
 */
export default function RequireAdmin({ children }) {
  const location = useLocation();
  const { signedIn, role, loading, error } = useSession();

  if (!signedIn || error || (!loading && !ADMIN_ROLES.has(role))) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  if (loading) return <RouteFallback />;

  return children;
}
