import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  // Every test states its own network expectations; an unmocked call should be
  // an obvious failure rather than a silent hang.
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
