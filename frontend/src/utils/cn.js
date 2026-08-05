/** Joins truthy class names — the app's only styling helper. */
export function cn(...values) {
  return values.filter(Boolean).join(' ');
}
