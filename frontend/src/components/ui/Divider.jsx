export function Divider({ className = "" }) {
  return <hr className={`divider ${className}`.trim()} style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "16px 0" }} />;
}
