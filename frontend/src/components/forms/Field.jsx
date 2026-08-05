import { useId } from 'react';
import { cn } from '@/utils/cn';

/** Labelled form row with hint/error slots. */
export function Field({ label, hint, error, htmlFor, className, children }) {
  return (
    <div className={cn('field', className)}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {hint && !error ? <span className="hint">{hint}</span> : null}
      {error ? <span className="err">{error}</span> : null}
    </div>
  );
}

export function Input({ invalid = false, className, ...rest }) {
  return <input className={cn('input', invalid && 'invalid', className)} {...rest} />;
}

export function Textarea({ invalid = false, className, ...rest }) {
  return <textarea className={cn('input', invalid && 'invalid', className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cn('select', className)} {...rest}>
      {children}
    </select>
  );
}

/** Field + Input in one call, with an auto-generated id. */
export function TextField({ label, hint, error, invalid, className, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <Input id={id} invalid={invalid ?? Boolean(error)} aria-invalid={error ? 'true' : undefined} {...rest} />
    </Field>
  );
}

/** Field + Select in one call. */
export function SelectField({ label, hint, error, className, children, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <Select id={id} {...rest}>
        {children}
      </Select>
    </Field>
  );
}

export function InputRow({ className, children }) {
  return <div className={cn('input-row', className)}>{children}</div>;
}
