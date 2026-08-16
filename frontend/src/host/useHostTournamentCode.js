import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getMyHostedTournaments } from '@/api/tournaments';

/**
 * Resolves which tournament a host workspace should open.
 *
 * <p>An explicit `?code=` wins. Otherwise the caller's own hosted tournaments
 * decide it. The host pages used to fall back to the seeded demo code, so every
 * host who did not happen to own that tournament hit a 403 on a page that
 * retried forever.
 */
export function useHostTournamentCode() {
  const [params] = useSearchParams();
  const explicit = params.get('code');
  const [resolved, setResolved] = useState({ code: null, loading: true, error: null });

  useEffect(() => {
    if (explicit) return undefined;
    let cancelled = false;
    getMyHostedTournaments()
      .then((list) => {
        if (cancelled) return;
        const first = Array.isArray(list) ? list[0] : null;
        setResolved({ code: first?.code ?? null, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setResolved({ code: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [explicit]);

  if (explicit) return { code: explicit, loading: false, error: null };
  return resolved;
}
