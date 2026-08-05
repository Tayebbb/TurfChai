import { useEffect, useRef, useState } from 'react';

/**
 * Small data-fetch hook: runs `fetcher` whenever `deps` change and exposes
 * { data, loading, error, reload }. Ignores out-of-order responses.
 */
export function useApi(fetcher, deps = []) {
  const [reloadTick, setReloadTick] = useState(0);
  const key = `${JSON.stringify(deps)}#${reloadTick}`;
  const [state, setState] = useState({ key, data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);

  // Latest-ref pattern: sync inside an effect (declared before the fetch
  // effect so it runs first in the same commit).
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Adjust-state-during-render: mark loading as soon as the inputs change.
  if (state.key !== key) {
    setState({ key, data: state.data, loading: true, error: null });
  }

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((data) => {
        if (!cancelled) setState({ key, data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ key, data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload: () => setReloadTick((tick) => tick + 1),
  };
}
