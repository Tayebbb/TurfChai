import { describe, expect, it } from 'vitest';
import { toUserMessage } from '@/utils/errorMessage';

/** TC-027: raw transport and server detail must never reach a user. */
describe('toUserMessage (TC-027)', () => {
  it('never surfaces a raw status line', () => {
    const error = Object.assign(new Error('Request failed with status 500'), { status: 500 });
    expect(toUserMessage(error)).not.toMatch(/status 500/);
  });

  it('replaces server internals on a 5xx', () => {
    const error = Object.assign(
      new Error('could not execute statement [NULL not allowed for column "PITCH_ID"]'),
      { status: 500 },
    );
    const message = toUserMessage(error);
    expect(message).not.toMatch(/statement/i);
    expect(message).not.toMatch(/PITCH_ID/);
  });

  it('replaces a Hibernate proxy error', () => {
    const error = Object.assign(
      new Error('org.hibernate.LazyInitializationException: Could not initialize proxy'),
      { status: 500 },
    );
    expect(toUserMessage(error)).not.toMatch(/hibernate/i);
  });

  it('keeps a domain message from a 4xx', () => {
    const error = Object.assign(new Error('This slot has already started and can no longer be booked'), {
      status: 409,
    });
    expect(toUserMessage(error)).toBe('This slot has already started and can no longer be booked');
  });

  it('maps a bare 403 to a permission message', () => {
    const error = Object.assign(new Error(''), { status: 403 });
    expect(toUserMessage(error)).toMatch(/permission/i);
  });

  it('maps a bare 401 to a session message', () => {
    const error = Object.assign(new Error(''), { status: 401 });
    expect(toUserMessage(error)).toMatch(/sign in/i);
  });

  it('explains an offline failure', () => {
    const error = Object.assign(new Error('Failed to fetch'), { status: 0, isNetworkError: true });
    expect(toUserMessage(error)).toMatch(/connection/i);
  });

  it('drops a technical 409 message in favour of the generic conflict line', () => {
    const error = Object.assign(new Error('Database constraint error: duplicate or invalid data'), {
      status: 409,
    });
    expect(toUserMessage(error)).not.toMatch(/constraint/i);
  });

  it('uses the caller-supplied fallback when nothing else fits', () => {
    const error = Object.assign(new Error(''), { status: 500 });
    expect(toUserMessage(error, 'Could not load your bookings.')).toBe('Could not load your bookings.');
  });

  it('never surfaces a browser exception that carries no status', () => {
    const error = new TypeError(
      "Failed to execute 'json' on 'Response': Unexpected end of JSON input",
    );
    const message = toUserMessage(error, 'Could not cancel this booking.');
    expect(message).toBe('Could not cancel this booking.');
    expect(message).not.toMatch(/json/i);
  });
});
