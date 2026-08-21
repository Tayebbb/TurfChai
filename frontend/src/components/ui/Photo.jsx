import { cn } from '@/utils/cn';

/** Gradient placeholder art or real uploaded photo. `variant` picks a palette (alt1–alt3, court, map). */
export function Photo({ variant, glyph, height, imgUrl, className, style, children, ...rest }) {
  const imageStyle = imgUrl
    ? {
        backgroundImage: `url("${imgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : null;

  return (
    <div
      className={cn('photo', variant, className)}
      style={{ height, ...imageStyle, ...style }}
      aria-hidden={children || glyph ? undefined : 'true'}
      {...rest}
    >
      {children ?? (imgUrl ? null : glyph)}
    </div>
  );
}
