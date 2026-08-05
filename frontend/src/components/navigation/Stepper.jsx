import { Fragment } from 'react';
import { cn } from '@/utils/cn';

/**
 * Booking/checkout progress indicator.
 * Items are `{ id, label }`; `current` is the active id.
 */
export function Stepper({ items, current, className }) {
  const currentIndex = items.findIndex((item) => item.id === current);

  return (
    <ol className={cn('stepper', className)} style={{ listStyle: 'none', padding: 0 }}>
      {items.map((item, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'on' : '';
        return (
          <Fragment key={item.id}>
            {index > 0 ? <li className={cn('step-line', index <= currentIndex && 'done')} /> : null}
            <li className={cn('step', state)} aria-current={state === 'on' ? 'step' : undefined}>
              <span className="dot">{index < currentIndex ? '✓' : index + 1}</span>
              {item.label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
