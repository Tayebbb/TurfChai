import { Fragment } from 'react';
import { cn } from '@/utils/cn';

/**
 * Booking/checkout/onboarding progress indicator.
 * Items are `{ id, label }`; `current` is the active id.
 * Optional `onStepChange` callback enables step navigation on click.
 */
export function Stepper({ items, current, onStepChange, className }) {
  const currentIndex = items.findIndex((item) => item.id === current);

  return (
    <ol className={cn('stepper', className)}>
      {items.map((item, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'on' : '';
        const isClickable = Boolean(onStepChange);

        return (
          <Fragment key={item.id}>
            {index > 0 ? <li className={cn('step-line', index <= currentIndex && 'done')} /> : null}
            <li
              className={cn('step', state, isClickable && 'clickable')}
              aria-current={state === 'on' ? 'step' : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={() => onStepChange?.(item.id, index)}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onStepChange(item.id, index);
                }
              }}
            >
              <span className="dot">{index < currentIndex ? '✓' : index + 1}</span>
              <span>{item.label}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

