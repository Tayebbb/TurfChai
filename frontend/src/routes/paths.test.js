import { describe, expect, it } from 'vitest';
import { findPathProblems } from '../../scripts/check-paths.mjs';

/**
 * TC-003 was a link built from `paths.player.booking`, a key that has never
 * existed. Nothing caught it because the branch only rendered once a real
 * booking came back. This asserts the whole route surface statically.
 */
describe('route helper integrity', () => {
  it('every paths.* usage in the app resolves to a defined route', () => {
    expect(findPathProblems()).toEqual([]);
  });
});
