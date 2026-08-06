import { cn } from '@/utils/cn';

/** Page container. `size` maps to .wrap / .wrap-narrow / .wrap-form. */
export function Wrap({ as: Tag = 'div', size = 'default', className, children, ...rest }) {
  const sizeClass =
    size === 'narrow' ? 'wrap-narrow' : size === 'form' ? 'wrap-form' : 'wrap';
  return (
    <Tag className={cn(sizeClass, className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Stack({ gap = 'md', className, children, ...rest }) {
  return (
    <div className={cn(gap === 'sm' ? 'stack-sm' : 'stack', className)} {...rest}>
      {children}
    </div>
  );
}

export function Row({ wrap = false, className, children, ...rest }) {
  return (
    <div className={cn(wrap ? 'row-wrap' : 'row', className)} {...rest}>
      {children}
    </div>
  );
}

export function Between({ className, children, ...rest }) {
  return (
    <div className={cn('between', className)} {...rest}>
      {children}
    </div>
  );
}

/** Responsive grid. `cols` is 2, 3 or 4. */
export function Grid({ cols = 2, className, children, ...rest }) {
  return (
    <div className={cn(`grid${cols}`, className)} {...rest}>
      {children}
    </div>
  );
}
