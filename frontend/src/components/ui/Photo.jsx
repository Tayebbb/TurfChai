import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/utils/cn';

/**
 * Gradient placeholder art or real uploaded photo.
 * If a photo URL fails to load, it automatically falls back to the next candidate photo in the list.
 * If all candidate photos fail or none are supplied, it falls back to the sport glyph and gradient styling.
 */
export function Photo({ variant, glyph, height, imgUrl, photos, className, style, children, ...rest }) {
  const candidateList = useMemo(() => {
    const list = [];
    if (Array.isArray(photos)) {
      photos.forEach((p) => {
        if (typeof p === 'string' && p.trim() && !list.includes(p.trim())) {
          list.push(p.trim());
        }
      });
    } else if (typeof photos === 'string' && photos.trim()) {
      photos.split(',').forEach((p) => {
        const trimmed = p.trim();
        if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      });
    }
    if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim() && !list.includes(imgUrl.trim())) {
      list.push(imgUrl.trim());
    }
    return list;
  }, [photos, imgUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [candidateList]);

  const activeUrl = candidateList[currentIndex] ?? null;

  const handleImageError = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  return (
    <div
      className={cn('photo', variant, className)}
      style={{
        height,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden={children || glyph ? undefined : 'true'}
      {...rest}
    >
      {activeUrl ? (
        <img
          src={activeUrl}
          alt=""
          loading="lazy"
          onError={handleImageError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : null}
      {children ?? (activeUrl ? null : glyph)}
    </div>
  );
}
