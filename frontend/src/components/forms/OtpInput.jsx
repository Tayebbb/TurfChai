import { useCallback, useRef } from 'react';

/** One-time-passcode entry with auto-advance and backspace handling. */
export function OtpInput({ length = 4, value = '', onChange, label = 'One-time passcode' }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const commit = useCallback(
    (index, digit) => {
      const next = digits.slice();
      next[index] = digit;
      onChange?.(next.join(''));
    },
    [digits, onChange],
  );

  const handleChange = (index) => (event) => {
    const digit = event.target.value.replace(/\D/g, '').slice(-1);
    commit(index, digit);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

