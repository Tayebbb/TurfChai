<<<<<<< HEAD
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
=======
export function Wrap({ children, className = "" }) {
  return (
    <div className={`wrap-form ${className}`.trim()}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}

<<<<<<< HEAD
export function Row({ wrap = false, className, children, ...rest }) {
  return (
    <div className={cn(wrap ? 'row-wrap' : 'row', className)} {...rest}>
=======
export function Row({ children, justify = "flex-start", align = "center", gap = 8, className = "" }) {
  return (
    <div className={`row ${className}`.trim()} style={{ display: "flex", justifyContent: justify, alignItems: align, gap }}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}

<<<<<<< HEAD
export function Between({ className, children, ...rest }) {
  return (
    <div className={cn('between', className)} {...rest}>
=======
export function Grid({ children, cols = 2, gap = 12, className = "" }) {
  return (
    <div className={`grid${cols} ${className}`.trim()} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}

<<<<<<< HEAD
/** Responsive grid. `cols` is 2, 3 or 4. */
export function Grid({ cols = 2, className, children, ...rest }) {
  return (
    <div className={cn(`grid${cols}`, className)} {...rest}>
=======
export function Stack({ children, gap = 12, className = "" }) {
  return (
    <div className={`stack ${className}`.trim()} style={{ display: "flex", flexDirection: "column", gap }}>
      {children}
    </div>
  );
}

export function Flex({ children, justify = "space-between", align = "center", gap = 8, className = "" }) {
  return (
    <div className={`flex ${className}`.trim()} style={{ display: "flex", justifyContent: justify, alignItems: align, gap }}>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
      {children}
    </div>
  );
}
