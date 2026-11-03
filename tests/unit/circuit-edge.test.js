// Edge cases for the circuit core (CLAUDE.md section 6).
import { describe, it, expect } from 'vitest';
import { close } from './helpers.js';
import { solveDC, Transient, estimateTimeConstants, solveLinear, isFiniteResult } from '../../js/core/circuit.js';
import {
  RANGES, oneResistor, seriesCircuit, parallelCircuit, twoBatteryCircuit, rcCircuit, capSeriesCircuit,
  capParallelCircuit, chargeSharingCircuit, rcExample1, rcExample2,
} from '../../js/content/presets.js';

describe('linear algebra', () => {
  it('solves with partial pivoting (zero on the diagonal)', () => {
    const x = solveLinear([0, 1, 1, 0], [2, 3], 2);
    expect(Array.from(x)).toEqual([3, 2]);
  });
  it('reports singular matrices as null', () => {
    expect(solveLinear([1, 2, 2, 4], [1, 2], 2)).toBeNull();
  });
});

describe('failures return { ok: false } and never throw', () => {
  it('floating node', () => {
    const res = solveDC({
      ground: '0',
      elements: [
        { type: 'V', id: 'B', neg: '0', pos: 'p', V: 12 },
        { type: 'R', id: 'R1', a: 'p', b: '0', R: 3 },
        { type: 'R', id: 'Rf', a: 'f1', b: 'f2', R: 5 },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/floating/);
  });
  it('node connected only through a capacitor floats in DC', () => {
    const res = solveDC(capSeriesCircuit(12, 6e-6, 3e-6));
    expect(res.ok).toBe(false);
  });
  it('two ideal batteries in parallel with different voltages is singular', () => {
    const res = solveDC({
      ground: '0',
      elements: [
        { type: 'V', id: 'B1', neg: '0', pos: 'p', V: 12 },
        { type: 'V', id: 'B2', neg: '0', pos: 'p', V: 6 },
        { type: 'R', id: 'R', a: 'p', b: '0', R: 3 },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/singular/);
  });
  it('bad inputs', () => {
    expect(solveDC(null).ok).toBe(false);
    expect(solveDC({ elements: [] }).ok).toBe(false);
    expect(solveDC(oneResistor(12, 0)).ok).toBe(false);
    expect(solveDC(oneResistor(12, NaN)).ok).toBe(false);
    expect(solveDC(oneResistor(NaN, 3)).ok).toBe(false);
    expect(solveDC({ elements: [{ type: 'X', id: 'x', a: '0', b: '1' }] }).ok).toBe(false);
    const sim = new Transient(oneResistor(12, -1), { dt: 1e-3 });
    expect(sim.ok).toBe(false);
    expect(sim.step()).toBe(false);
  });
});

describe('every element at its slider min and max', () => {
  const { emf, R, R2 } = RANGES;
  for (const E of [emf.min, emf.max]) {
    for (const r1 of [R.min, R.max]) {
      for (const r2 of [R2.min, R2.max]) {
        it(`ε=${E} V, R1=${r1} Ω, R2=${r2} Ω`, () => {
          close(solveDC(oneResistor(E, r1)).I.R1, E / r1);
          close(solveDC(seriesCircuit(E, r1, r2)).I.B, E / (r1 + r2));
          close(solveDC(parallelCircuit(E, r1, r2)).I.B, E / r1 + E / r2);
        });
      }
    }
  }
  const { rcR, rcC, rcEmf } = RANGES;
  for (const r of [rcR.min, rcR.max]) {
    for (const c of [rcC.min, rcC.max]) {
      it(`RC: R=${r} Ω, C=${c} F`, () => {
        const tau = r * c;
        close(estimateTimeConstants(rcCircuit(rcEmf.max, r, c)).tauMin, tau);
        const sim = new Transient(rcCircuit(rcEmf.max, r, c), { dt: tau / 1000 });
        sim.runUntil(tau);
        close(sim.state.q.C, 0.632 * c * rcEmf.max);
        expect(isFiniteResult(sim.state)).toBe(true);
      });
    }
  }
  const { capC, capC2, capEmf } = RANGES;
  for (const c1 of [capC.min, capC.max]) {
    for (const c2 of [capC2.min, capC2.max]) {
      it(`capacitors: C1=${c1}, C2=${c2}`, () => {
        for (const build of [capSeriesCircuit, capParallelCircuit]) {
          const circuit = build(capEmf.max, c1, c2);
          const est = estimateTimeConstants(circuit);
          const sim = new Transient(circuit, { dt: est.tauMin / 200 });
          sim.runUntil(est.tauMax * 25);
          const q1 = sim.state.q.C1;
          if (build === capSeriesCircuit) close(q1, ((c1 * c2) / (c1 + c2)) * capEmf.max);
          else close(q1, c1 * capEmf.max);
        }
      });
    }
  }
  const { shareC1, shareC2, shareV, shareRw } = RANGES;
  for (const rw of [shareRw.min, shareRw.max]) {
    it(`charge sharing with wire R=${rw} Ω at extreme capacitances`, () => {
      for (const [c1, c2] of [[shareC1.min, shareC2.max], [shareC1.max, shareC2.min]]) {
        const circuit = chargeSharingCircuit(c1, shareV.max, c2, rw, true);
        const est = estimateTimeConstants(circuit);
        const sim = new Transient(circuit, { dt: est.tauMin / 200 });
        sim.runUntil(est.tauMax * 25);
        close(sim.state.V.u, (c1 * shareV.max) / (c1 + c2));
      }
    });
  }
});

describe('opposing batteries', () => {
  it('12 V against 6 V in one loop with 3 Ω: 2 A, and the 6 V battery is charged', () => {
    const res = solveDC({
      ground: '0',
      elements: [
        { type: 'V', id: 'B1', neg: '0', pos: 'a', V: 12 },
        { type: 'R', id: 'R', a: 'a', b: 'b', R: 3 },
        { type: 'V', id: 'B2', neg: '0', pos: 'b', V: 6 },
      ],
    });
    close(res.I.R, 2);
    close(res.I.B2, -2);
    close(res.P.B2, 12); // absorbs 12 W
  });
  it('two-battery circuit with the second battery flipped', () => {
    const c = twoBatteryCircuit();
    c.elements[3] = { type: 'V', id: 'B2', neg: 'r', pos: '0', V: 6 };
    const res = solveDC(c);
    // Node equation: (12 − V)/2 = V/4 + (V + 6)/6  →  72 − 6V = 5V + 12  →  V = 60/11
    close(res.V.t, 60 / 11);
    close(res.I.R1, res.I.R2 + res.I.R3, 1e-9);
  });
  it('battery internal resistance lowers the terminal voltage', () => {
    const res = solveDC({
      ground: '0',
      elements: [
        { type: 'V', id: 'B', neg: '0', pos: 'p', V: 12, r: 1 },
        { type: 'R', id: 'R', a: 'p', b: '0', R: 5 },
      ],
    });
    close(res.I.B, 2);
    close(res.V.p, 10);
  });
});

describe('switches mid-transient', () => {
  it('charge for one τ, flip to discharge, and the charge decays from there', () => {
    const emf = 12; const R = 20e3; const C = 150e-6; const tau = R * C;
    const circuit = rcCircuit(emf, R, C, 'charge');
    const sim = new Transient(circuit, { dt: tau / 2000 });
    sim.runUntil(tau);
    const q1 = sim.state.q.C;
    close(q1, 0.632 * C * emf);
    circuit.elements.find((e) => e.id === 'Sc').closed = false;
    circuit.elements.find((e) => e.id === 'Sd').closed = true;
    sim.rebuild();
    // Current reverses instantly: I = −q/(RC)
    close(sim.state.I.R, -q1 / (R * C));
    const t0 = sim.t;
    sim.runUntil(t0 + tau);
    close(sim.state.q.C, q1 * Math.exp(-1));
  });
  it('opening the only switch freezes the charge', () => {
    const circuit = rcCircuit(12, 20e3, 150e-6, 'charge');
    const sim = new Transient(circuit, { dt: 3 / 1000 });
    sim.runUntil(3);
    const q = sim.state.q.C;
    circuit.elements.find((e) => e.id === 'Sc').closed = false;
    sim.rebuild();
    expect(sim.ok).toBe(true);
    sim.runUntil(10);
    close(sim.state.q.C, q, 1e-6);
    expect(Math.abs(sim.state.I.R)).toBeLessThan(1e-12);
  });
  it('trapezoidal current has no ringing right after a switch event', () => {
    const circuit = rcExample1({}, false, 100e-6);
    circuit.elements.find((e) => e.id === 'S').closed = true;
    const sim = new Transient(circuit, { dt: 0.01 });
    const vals = [];
    for (let i = 0; i < 5; i++) { sim.step(); vals.push(sim.state.I.S); }
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeLessThan(vals[i - 1]);
  });
});

describe('very small and very large τ', () => {
  it('τ = 1 Ω × 1 pF = 1 ps', () => {
    const tau = 1e-12;
    const c = rcCircuit(5, 1, 1e-12);
    close(estimateTimeConstants(c).tauMin, tau);
    const sim = new Transient(c, { dt: tau / 1000 });
    sim.runUntil(tau);
    close(sim.state.q.C, 0.632 * 1e-12 * 5);
  });
  it('τ = 1 MΩ × 1 F = 10⁶ s', () => {
    const tau = 1e6;
    const c = rcCircuit(5, 1e6, 1);
    close(estimateTimeConstants(c).tauMin, tau);
    const sim = new Transient(c, { dt: tau / 1000 });
    sim.runUntil(tau);
    close(sim.state.q.C, 0.632 * 5);
  });
  it('auto method stays stable when dt ≫ τ (backward Euler fallback)', () => {
    const sim = new Transient(rcCircuit(5, 1, 1e-6), { dt: 1e-3, method: 'auto' });
    sim.step(10);
    close(sim.state.q.C, 5e-6, 1e-6);
    expect(Math.abs(sim.state.I.R)).toBeLessThan(1e-9);
  });
});

describe('time constants', () => {
  it('match the analytic values for the slide examples', () => {
    close(estimateTimeConstants(rcExample1({}, false)).tauMin, 1.5);
    close(estimateTimeConstants(rcExample1({}, true)).tauMin, 1.0);
    close(estimateTimeConstants(rcExample2({}, false)).tauMin, 0.18);
    // With the switch closed the capacitor sees 3 kΩ + (12 kΩ ∥ 15 kΩ)
    close(estimateTimeConstants(rcExample2({}, true)).tauMin, (3e3 + (12e3 * 15e3) / 27e3) * 10e-6);
  });
  it('series and parallel capacitors have one mode each', () => {
    const s = estimateTimeConstants(capSeriesCircuit(12, 6e-6, 3e-6, 1));
    expect(s.modes.length).toBe(1);
    close(s.tauMin, 2e-6);
    const p = estimateTimeConstants(capParallelCircuit(12, 6e-6, 3e-6, 1));
    expect(p.modes.length).toBe(1);
    close(p.tauMin, 9e-6);
  });
  it('no capacitors: nothing decays', () => {
    const e = estimateTimeConstants(oneResistor(12, 3));
    expect(e.tauMin).toBe(Infinity);
  });
});
