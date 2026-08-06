export function PageContainer({ children, className = "" }) {
  return (
    <div className={`wrap-form ${className}`.trim()}>
      {children}
    </div>
  );
}
