import { cn } from '@/utils/cn';

/**
 * Bookable time grid.
 * `slots`: `{ id, time, price, status: 'available' | 'held' | 'booked' }`.
 */
export function SlotGrid({ slots, selectedId, onSelect, label = 'Available slots', className }) {
  return (
    <div className={cn('slotgrid', className)} role="group" aria-label={label}>
      {slots.map((slot) => {
        const isSelected = slot.id === selectedId;
        const state = isSelected ? 'selected' : slot.status;
        // Anything that is not free to book is unselectable — `blocked` counts,
        // and so does any status added later.
        const disabled = slot.status !== 'available';

        return (
          <button
            key={slot.id}
            className={cn('slot', state)}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={`${slot.time}${disabled ? ` — ${slot.status}` : ''}`}
            onClick={() => !disabled && onSelect?.(slot)}
          >
            <b>{slot.time}</b>
            <span>{slot.price}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Horizontal day picker.
 * `dates`: `{ id, weekday, day }`.
 */
export function DateStrip({ dates, selectedId, onSelect, label = 'Choose a date', className }) {
  return (
    <div className={cn('datestrip', className)} role="group" aria-label={label}>
      {dates.map((date) => (
        <button
          key={date.id}
          className={cn('datebox', date.id === selectedId && 'on')}
          type="button"
          aria-pressed={date.id === selectedId}
          onClick={() => onSelect?.(date)}
        >
          <span>{date.weekday}</span>
          <b>{date.day}</b>
        </button>
      ))}
    </div>
  );
}