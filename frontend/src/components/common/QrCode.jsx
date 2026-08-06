import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

/**
 * Scannable QR code. The encoder is a lazy chunk so it never lands in the
 * main bundle, and the modules are always dark-on-white so gate scanners
 * work in either theme. Rendered as an SVG image so it stays crisp at
 * whatever size the caller's box is.
 */
export function QrCode({ value, label, className, style }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toString(value, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#0B140F', light: '#FFFFFF' },
        }),
      )
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      className={cn('qr', failed && 'qr-placeholder', className)}
      style={style}
      role="img"
      aria-label={label}
      title={failed ? value : undefined}
    >
      {src && !failed ? <img src={src} alt="" /> : null}
    </div>
  );
}
