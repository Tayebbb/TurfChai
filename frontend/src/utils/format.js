import { CURRENCY } from '@/constants/app';

const numberFormat = new Intl.NumberFormat('en-BD');

/** `2500` → `৳2,500` */
export function formatBdt(amount, { sign = false } = {}) {
  const value = Number(amount) || 0;
  const prefix = sign && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${CURRENCY}${numberFormat.format(Math.abs(value))}`;
}

/** `1240` → `1,240` */
export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

/** `152` → `0:00`-style clock used by slot-lock countdowns. */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `0.72` → `72%` */
export function formatPercent(ratio, digits = 0) {
  return `${(Number(ratio) * 100).toFixed(digits)}%`;
}

/** Turns "Rafiul Karim" into "RK" for avatar fallbacks. */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
