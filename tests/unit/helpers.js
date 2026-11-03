import { expect } from 'vitest';

/** Assert |actual − expected| ≤ tol·|expected| (default 0.5%, the answer-key tolerance). */
export function close(actual, expected, tol = 0.005, label = '') {
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tol * Math.abs(expected);
  expect(ok, `${label} expected ${expected}, got ${actual} (tol ${tol * 100}%)`).toBe(true);
}
