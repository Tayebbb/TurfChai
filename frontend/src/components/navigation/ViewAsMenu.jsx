import { useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useEscapeKey } from '@/hooks/useEscapeKey';

/**
 * Glass "View as <Mode>" workspace switcher.
 * Options: `{ id, label, description }`.
 */
export function ViewAsMenu({ options, value, onChange, label = 'Dashboard mode' }) {
  const containerRef = useRef(null);
  const { isOpen, close, toggle } = useDisclosure(false);

  useClickOutside(containerRef, close, isOpen);
  useEscapeKey(close, isOpen);

  const current = options.find((option) => option.id === value);

  return (
    <div className={isOpen ? 'viewas open' : 'viewas'} ref={containerRef}>
      <button
        className="viewas-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        View as <b>{current?.label}</b>{' '}
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="viewas-menu" role="listbox" aria-label={label}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={selected ? 'on' : undefined}
              onClick={() => {
                onChange(option.id);
                close();
              }}
            >
              <span>
                {option.label}
                <span className="desc">{option.description}</span>
              </span>
              <span className="check" aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
