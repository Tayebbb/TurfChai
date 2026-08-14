export function Stat({ label, value, subtext, className = "" }) {
  return (
    <div className={`stat-card ${className}`.trim()}>
      <span className="tiny subtle">{label}</span>
      <b className="num" style={{ fontSize: 22, display: "block" }}>{value}</b>
      {subtext && <span className="small muted">{subtext}</span>}
    </div>
  );
}
