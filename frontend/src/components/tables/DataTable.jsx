import { cn } from '@/utils/cn';

/**
 * Scroll-safe data table.
 * `columns`: `{ key, header, align?, render?(row) }`.
 */
export function DataTable({ columns, rows, getRowKey, caption, minWidth, className, empty }) {
  if (!rows.length && empty) return empty;

  return (
    <div className={cn('table-wrap', className)}>
      <table className="table" style={minWidth ? { minWidth } : undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === 'right' ? 'num' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey ? getRowKey(row, index) : (row.id ?? index)}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}