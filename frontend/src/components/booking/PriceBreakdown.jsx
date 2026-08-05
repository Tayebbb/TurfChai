import { cn } from '@/utils/cn';

/** Line item in a price breakdown. */
export function PriceRow({ label, value, negative = false, total = false }) {
  return (
    <div className={cn('pricerow', total && 'total')}>
      <span>{label}</span>
      <span className={negative ? 'neg' : undefined}>{value}</span>
    </div>
  );
}

/** Ordered price breakdown; the last row is emphasised as the total. */
export function PriceBreakdown({ rows, total }) {
  return (
    <div>
      {rows.map((row) => (
        <PriceRow key={row.label} {...row} />
      ))}
      {total ? <PriceRow {...total} total /> : null}
    </div>
  );
}