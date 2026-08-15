import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { RouteFallback } from '@/components/common/RouteFallback';
import { getMe } from '@/api/auth';
import { clearSession, getToken } from '@/api/client';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Guards the admin console. The API is already protected server-side, but the
 * console shell must not render for anonymous visitors — so before showing
 * anything this component validates the stored session against the backend
 * (`GET /me`) and bounces non-admins to the sign-in page.
 *
 * Any locally-spoofed "session" is caught here too: a made-up token fails the
 * `/me` call, the session is cleared, and the visitor is redirected.
 */
export default function RequireAdmin({ children }) {
  const location = useLocation();
  const token = getToken();
  const [status, setStatus] = useState('checking'); // checking | ok | redirect

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setStatus('redirect');
      return;
    }

    getMe()
      .then((user) => {
        if (cancelled) return;
        if (user && ADMIN_ROLES.has(user.role)) {
          setStatus('ok');
        } else {
          clearSession();
          setStatus('redirect');
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setStatus('redirect');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'checking') return <RouteFallback />;
  if (status === 'redirect') {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return children;
}