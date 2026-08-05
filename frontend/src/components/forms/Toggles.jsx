import { useId } from 'react';
import { cn } from '@/utils/cn';

/** Checkbox with an inline description. */
export function Checkline({ label, className, ...rest }) {
  const id = useId();
  return (
    <label className={cn('checkline', className)} htmlFor={id}>
      <input id={id} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

