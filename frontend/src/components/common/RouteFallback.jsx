/** Skeleton shown while a lazily-loaded route chunk downloads. */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div className="skeleton head" />
      <div className="skeleton block" />
      <div className="skeleton" />
      <div className="skeleton" style={{ width: '60%' }} />
    </div>
  );
}
