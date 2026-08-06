// k6 load test for the booking hold-slot endpoint.
//
// Verifies the pessimistic row lock: N VUs race to hold ONE slot; exactly
// one caller must win (200) and every other caller must be rejected (409).
// Any 500 or timeout fails the run via thresholds.
//
// Usage:
//   1. Seed one AVAILABLE slot and note its id.
//   2. Create N users, generate one valid JWT per user, one per line in a
//      file (tokens are read from the file; never commit them).
//   3. Run:
//      k6 run scripts/load-test.js -e SLOT_ID=<id> -e K6_TOKEN_FILE=/path/to/tokens.txt
//
// Optional env:
//   K6_VUS        number of concurrent callers (default 50)
//   BACKEND_URL   base URL (default http://localhost:8080)

import http from 'k6/http';
import { Counter } from 'k6/metrics';

const VUS = Number(__ENV.K6_VUS || 50);
const SLOT_ID = Number(__ENV.SLOT_ID || 1);
const BASE_URL = (__ENV.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const TOKEN_FILE = __ENV.K6_TOKEN_FILE;

if (!TOKEN_FILE) {
  throw new Error('K6_TOKEN_FILE is required — a file with one JWT per line');
}

const tokens = open(TOKEN_FILE).split('\n').map((t) => t.trim()).filter(Boolean);
if (tokens.length < VUS) {
  throw new Error(`Need at least ${VUS} tokens, found ${tokens.length}`);
}

const holdOk = new Counter('hold_ok_200');
const holdConflict = new Counter('hold_conflict_409');
const holdServerError = new Counter('hold_5xx');
const holdOther = new Counter('hold_other');
const holdTimeout = new Counter('hold_timeout');

export const options = {
  scenarios: {
    race: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: VUS,
      maxDuration: '60s',
    },
  },
  thresholds: {
    // exactly one winner, everyone else a clean 409, no server errors/timeouts
    hold_ok_200: [{ threshold: `count == 1`, abortOnFail: true }],
    hold_conflict_409: [{ threshold: `count == ${VUS - 1}`, abortOnFail: true }],
    hold_5xx: [{ threshold: `count == 0`, abortOnFail: true }],
    hold_timeout: [{ threshold: `count == 0`, abortOnFail: true }],
  },
};

export default function () {
  const token = tokens[__ITER % tokens.length];
  let res;
  try {
    res = http.post(
      `${BASE_URL}/api/v1/bookings/hold-slot`,
      JSON.stringify({ slotId: SLOT_ID }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (err) {
    holdTimeout.add(1);
    return;
  }

  if (res.status === 200) holdOk.add(1);
  else if (res.status === 409) holdConflict.add(1);
  else if (res.status >= 500) holdServerError.add(1);
  else holdOther.add(1);
}
