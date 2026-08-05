import { useEffect } from 'react';

const SUFFIX = 'TurfChai';

/** Sets `document.title` for the mounted route. */
export function PageTitle({ title }) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);

  return null;
}
