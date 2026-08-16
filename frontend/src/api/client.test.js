import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiSend, apiGet } from './client';

/**
 * Several backend endpoints answer 200 with an empty body (ResponseEntity<Void>).
 * Parsing those as JSON threw at the caller, which surfaced as a failure toast on
 * an action that had in fact succeeded.
 */
function response({ status = 200, body = '', contentType = 'application/json' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

describe('api client body handling', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('treats an empty 200 body as a success with no payload', async () => {
    globalThis.fetch.mockResolvedValue(response({ body: '' }));
    await expect(apiSend('POST', '/api/v1/owner/bookings/1/cancel')).resolves.toBeNull();
  });

  it('treats 204 as a success with no payload', async () => {
    globalThis.fetch.mockResolvedValue(response({ status: 204 }));
    await expect(apiSend('POST', '/api/v1/things')).resolves.toBeNull();
  });

  it('still parses a JSON payload', async () => {
    globalThis.fetch.mockResolvedValue(response({ body: '{"id":7}' }));
    await expect(apiGet('/api/v1/things/7')).resolves.toEqual({ id: 7 });
  });

  it('returns text unchanged when the response is not JSON', async () => {
    globalThis.fetch.mockResolvedValue(response({ body: 'OK', contentType: 'text/plain' }));
    await expect(apiGet('/api/v1/ping')).resolves.toBe('OK');
  });
});
