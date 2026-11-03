import { describe, it, expect } from 'vitest';
import { parseHash, buildHash } from '../../js/ui/route.js';

describe('hash routing', () => {
  it('parses module routes and sub-routes', () => {
    expect(parseHash('#/')).toEqual({ top: '', sub: '' });
    expect(parseHash('')).toEqual({ top: '', sub: '' });
    expect(parseHash('#/circuits')).toEqual({ top: 'circuits', sub: '' });
    expect(parseHash('#/circuits/parallel')).toEqual({ top: 'circuits', sub: 'parallel' });
    expect(parseHash('#/rc/solve/1')).toEqual({ top: 'rc', sub: 'solve/1' });
  });
  it('falls back to home for unknown routes', () => {
    expect(parseHash('#/nope')).toEqual({ top: '', sub: '' });
  });
  it('builds hashes', () => {
    expect(buildHash('', '')).toBe('#/');
    expect(buildHash('fields', '')).toBe('#/fields');
    expect(buildHash('fields', 'dipole')).toBe('#/fields/dipole');
  });
});
