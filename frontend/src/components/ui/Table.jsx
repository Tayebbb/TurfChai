export function Table({ headers = [], children, className = "" }) {
  return (
    <div className="table-responsive">
      <table className={`table ${className}`.trim()} style={{ width: "100%", borderCollapse: "collapse" }}>
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, idx) => (
                <th key={idx} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
