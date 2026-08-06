export function Tooltip({ content, children }) {
  return (
    <span className="tooltip-wrapper" title={content}>
      {children}
    </span>
  );
}
