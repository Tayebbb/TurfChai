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

  return (
    <div className="otp-row" role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className="otp"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
        />
      ))}
    </div>
  );
}
