<<<<<<< HEAD
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
=======
export function Photo({ src, alt, ratio = "16/9", className = "", ...props }) {
  if (!src) {
    return (
      <div className={`photo-placeholder ${className}`.trim()} style={{ aspectRatio: ratio, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>⚽</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "Venue photo"}
      className={`photo ${className}`.trim()}
      style={{ aspectRatio: ratio, objectFit: "cover", width: "100%", borderRadius: 12 }}
      {...props}
    />
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
  );
}
