import { cn } from '@/utils/cn';

/** Gradient placeholder art. `variant` picks a palette (alt1–alt3, court, map). */
export function Photo({ variant, glyph, height, className, style, children, ...rest }) {
  return (
    <div
      className={cn('photo', variant, className)}
      style={{ height, ...style }}
      aria-hidden={children || glyph ? undefined : 'true'}
      {...rest}
    >
      {children ?? glyph}
    </div>
  );
}
