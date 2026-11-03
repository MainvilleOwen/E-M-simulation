import { describe, it, expect } from 'vitest';
import { close } from './helpers.js';
import {
  K, fieldAt, fieldContributions, potentialAt, arrowLength, traceFieldLine, fieldLines,
  dipoleForces, dipoleTorque, dipoleEnergy, stepDipole, wrapAngle,
} from '../../js/core/fields.js';

const nC = 1e-9;

describe('Coulomb superposition', () => {
  it('single charge: E = kq/r²', () => {
    const E = fieldAt([{ x: 0, y: 0, q: nC }], 0.01, 0);
    close(E.Ex, (K * nC) / 1e-4);
    expect(Math.abs(E.Ey)).toBeLessThan(1e-9);
  });
  it('zero field at the midpoint of equal like charges', () => {
    const charges = [{ x: -0.02, y: 0, q: 2 * nC }, { x: 0.02, y: 0, q: 2 * nC }];
    const E = fieldAt(charges, 0, 0);
    expect(Math.hypot(E.Ex, E.Ey)).toBeLessThan(1e-9);
  });
  it('mirror symmetry for equal like charges', () => {
    const charges = [{ x: -0.02, y: 0, q: nC }, { x: 0.02, y: 0, q: nC }];
    const a = fieldAt(charges, 0.01, 0.015);
    const b = fieldAt(charges, -0.01, 0.015);
    close(a.Ex, -b.Ex, 1e-9);
    close(a.Ey, b.Ey, 1e-9);
  });
  it('contributions add up to the total', () => {
    const charges = [{ x: 0, y: 0, q: nC }, { x: 0.03, y: 0.01, q: -2 * nC }, { x: -0.01, y: 0.02, q: 0.5 * nC }];
    const parts = fieldContributions(charges, 0.012, -0.007);
    const tot = fieldAt(charges, 0.012, -0.007);
    close(parts.reduce((s, p) => s + p.Ex, 0), tot.Ex, 1e-12);
    close(parts.reduce((s, p) => s + p.Ey, 0), tot.Ey, 1e-12);
  });
  it('softening keeps the field finite at a charge', () => {
    const E = fieldAt([{ x: 0, y: 0, q: nC }], 0, 0, 0.002);
    expect(Number.isFinite(E.Ex) && Number.isFinite(E.Ey)).toBe(true);
    const V = potentialAt([{ x: 0, y: 0, q: nC }], 0, 0, 0.002);
    expect(Number.isFinite(V)).toBe(true);
  });
  it('dipole: on-axis field ≈ 2kp/r³ and bisector field ≈ kp/r³ (pointing opposite p)', () => {
    const d = 0.002; const q = nC; const p = q * d; const r = 0.1;
    const charges = [{ x: d / 2, y: 0, q }, { x: -d / 2, y: 0, q: -q }];
    const axis = fieldAt(charges, r, 0);
    close(axis.Ex, (2 * K * p) / r ** 3, 0.005);
    const bis = fieldAt(charges, 0, r);
    close(bis.Ex, -(K * p) / r ** 3, 0.005);
    expect(Math.abs(bis.Ey)).toBeLessThan(1e-9 * Math.abs(bis.Ex) + 1e-12);
  });
});

describe('display helpers', () => {
  it('arrow length is log-scaled and clamped', () => {
    const o = { minMag: 1, maxMag: 1e4, minLen: 4, maxLen: 20 };
    expect(arrowLength(1, o)).toBe(4);
    expect(arrowLength(1e4, o)).toBe(20);
    expect(arrowLength(100, o)).toBeCloseTo(12, 9);
    expect(arrowLength(1e9, o)).toBe(20);
    expect(arrowLength(0, o)).toBe(4);
    expect(arrowLength(NaN, o)).toBe(4);
  });
  it('field lines leave + charges and end on − charges', () => {
    const charges = [{ x: -0.02, y: 0, q: nC }, { x: 0.02, y: 0, q: -nC }];
    const line = traceFieldLine(charges, -0.014, 0.001, { bounds: { x0: -0.2, y0: -0.2, x1: 0.2, y1: 0.2 } });
    expect(line.endCharge).toBe(1);
    const lines = fieldLines(charges, { bounds: { x0: -0.2, y0: -0.2, x1: 0.2, y1: 0.2 } });
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.filter((l) => l.to === 1).length).toBeGreaterThanOrEqual(6);
  });
});

describe('dipole in a uniform field', () => {
  it('net force is zero and |torque| = pE sin θ', () => {
    const q = 2e-9; const d = 0.01; const E = 5e4; const p = q * d;
    for (const theta of [0.3, 1.0, Math.PI / 2, 2.5, -1.2]) {
      const f = dipoleForces(q, d, E, theta);
      expect(Math.abs(f.net.x) + Math.abs(f.net.y)).toBe(0);
      close(Math.abs(f.torque), p * E * Math.abs(Math.sin(theta)), 1e-9);
      close(f.torque, dipoleTorque(p, E, theta), 1e-9);
    }
  });
  it('U = −pE cos θ: lowest when aligned', () => {
    expect(dipoleEnergy(1, 1, 0)).toBe(-1);
    close(dipoleEnergy(1, 1, Math.PI), 1, 1e-12);
  });
  it('damped rotation settles to θ = 0', () => {
    let s = { theta: 2.5, omega: 0 };
    const params = { p: 1e-11, E: 1e4, I: 1e-8, b: 2e-8 };
    for (let i = 0; i < 20000; i++) s = stepDipole(s, params, 1e-3);
    expect(Math.abs(wrapAngle(s.theta))).toBeLessThan(1e-3);
  });
  it('undamped rotation conserves energy', () => {
    let s = { theta: 1.2, omega: 0 };
    const params = { p: 1, E: 1, I: 1, b: 0 };
    const E0 = 0.5 * s.omega ** 2 + dipoleEnergy(1, 1, s.theta);
    for (let i = 0; i < 5000; i++) s = stepDipole(s, params, 1e-3);
    const E1 = 0.5 * s.omega ** 2 + dipoleEnergy(1, 1, s.theta);
    expect(Math.abs(E1 - E0)).toBeLessThan(1e-9);
  });
});
