import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Longest we wait for a lazy route to set its own title before announcing. */
const SETTLE_MS = 500;

/**
 * Router navigation swaps the DOM without a page load, so assistive tech is
 * never told the view changed. Mirrors the title PageTitle sets into a live
 * region, watching the <title> node so lazy chunks announce once they resolve.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState('');
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // The browser announces the first page itself; only navigations need this.
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return undefined;
    }

    const titleNode = document.querySelector('title');
    let timer;

    const announce = () => {
      window.clearTimeout(timer);
      setAnnouncement(`${document.title}, page loaded`);
    };

    // Backstop for routes that never set a title of their own.
    timer = window.setTimeout(announce, SETTLE_MS);

    const observer = titleNode ? new MutationObserver(announce) : null;
    observer?.observe(titleNode, { childList: true });

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [pathname]);

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );
}
