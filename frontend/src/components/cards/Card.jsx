import { cn } from '@/utils/cn';

/** Standard content card. */
export function Card({ as: Tag = 'div', center = false, flat = false, className, children, ...rest }) {
  return (
    <Tag className={cn(flat ? 'card-flat' : 'card', center && 'center', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Frosted variant used for hero panels and highlighted blocks. */
export function GlassCard({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cn('glass glass-card', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Apple-style liquid-glass surface used across the consoles. */
export function LiquidCard({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cn('liquid-glass', className)} {...rest}>
      {children}
    </Tag>
  );
}
