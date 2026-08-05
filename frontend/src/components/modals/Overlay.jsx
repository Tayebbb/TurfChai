import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/components/buttons/IconButton';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { cn } from '@/utils/cn';

const MODES = { modal: '', sheet: 'sheet-mode', drawer: 'drawer-mode' };

/**
 * Accessible modal / bottom sheet / side drawer.
 * Traps focus, restores it on close, and closes on Escape or backdrop click.
 */
export function Overlay({
  isOpen,
  onClose,
  title,
  mode = 'modal',
  hideHeader = false,
  showGrabber = false,
  maxWidth,
  className,
  children,
}) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEscapeKey(onClose, isOpen);
  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [isOpen]);

  const onKeyDown = useCallback((event) => {
    if (event.key !== 'Tab') return;
    const focusables = panelRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn('overlay open', MODES[mode])}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn('modal', className)}
        style={maxWidth ? { maxWidth } : undefined}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {showGrabber ? <div className="grabber" /> : null}
        {!hideHeader ? (
          <div className="between">
            <h3 style={{ margin: 0 }}>{title}</h3>
            <IconButton label="Close" onClick={onClose}>
              ✕
            </IconButton>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
