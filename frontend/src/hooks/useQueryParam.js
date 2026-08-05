import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads/writes a single query-string value.
 * Replaces the prototype's `location.hash` deep-links (`#host`, `#rewards`).
 */
export function useQueryParam(key, fallback = '') {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? fallback;

  const setValue = useCallback(
    (next, { replace = true } = {}) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === null || next === undefined || next === '') params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace },
      );
    },
    [key, setSearchParams],
  );

  return [value, setValue];
}
