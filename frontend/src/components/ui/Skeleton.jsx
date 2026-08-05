import { cn } from '@/utils/cn';

/** Shimmering placeholder block. */
export function Skeleton({ height = 16, width = '100%', radius, className, style, ...rest }) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

/** Repeats a skeleton row `count` times. */
export function SkeletonList({ count = 3, height = 72, gap = 12 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </div>
  );
}
