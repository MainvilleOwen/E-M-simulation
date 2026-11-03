// CLAUDE.md section 5: every row of the verified answer key, within 0.5%.
import { describe, it, expect } from 'vitest';
import { close } from './helpers.js';
import { solveDC, Transient, estimateTimeConstants, equivalentResistance } from '../../js/core/circuit.js';
import * as F from '../../js/core/formulas.js';
import {
  oneResistor, seriesCircuit, parallelCircuit, combinationCircuit, bulbCircuit, twoBatteryCircuit,
  rcCircuit, rcExample1, rcExample2, capSeriesCircuit, capParallelCircuit, chargeSharingCircuit, capNetworkCircuit,
} from '../../js/content/presets.js';

const uF = 1e-6;

/** Run a transient to (near) steady state using the solver's own τ estimate. */
function settle(circuit, taus = 30) {
  const est = estimateTimeConstants(circuit);
  const dt = est.tauMin / 200;
  const sim = new Transient(circuit, { dt });
  sim.runUntil(est.tauMax * taus);
  expect(sim.ok).toBe(true);
  return sim;
}

describe('Ch 26: current and resistance', () => {
  it('Ex 1: 18-gauge copper wire, J and drift speed', () => {
    const A = F.wireArea(1.02e-3);
    close(F.currentDensity(1.67, A), 2.04e6);
    close(F.driftSpeed(1.67, 8.5e28, A), 1.50e-4);
  });
  it('Ex 2: field, voltage and resistance over 50 m', () => {
    const J = F.currentDensity(1.67, 8.2e-7);
    const E = F.fieldInWire(1.72e-8, J);
    close(E, 0.0350);
    close(E * 50, 1.75);
    close(F.resistance(1.72e-8, 50, 8.2e-7), 1.05);
  });
  it('Ex 3: copper resistance at 0 °C and 100 °C', () => {
    close(F.resistanceAtT(1.05, 0.00393, 0, 20), 0.967);
    close(F.resistanceAtT(1.05, 0.00393, 100, 20), 1.38);
  });
  it('Ex 4: platinum thermometer temperature', () => {
    close(F.tempForResistance(76.8, 50.0, 3.92e-3, 20), 156.7);
  });
  it('Example 26.2: nichrome resistance per metre', () => {
    close(F.resistancePerLength(1.0e-6, F.areaFromRadius(0.32e-3)), 3.1);
  });
  it('Example 26.4: heater (1.80 kW, not 1.8×10³ kW)', () => {
    const res = solveDC(oneResistor(120, 8));
    expect(res.ok).toBe(true);
    close(res.I.R1, 15.0);
    close(res.P.R1, 1800);
    close(F.powerVR(120, 8), 1800);
  });
});

describe('Ch 25: capacitance', () => {
  it('Ex 1: plate area for 1.0 F at 1.0 mm (1.13×10⁸ m², not 11×10⁸)', () => {
    close(F.plateAreaFor(1.0, 1.0e-3), 1.13e8);
  });
  it('Ex 2: C, Q and E', () => {
    const C = F.plateCapacitance(2.0, 5.0e-3);
    close(C, 3.54e-9);
    close(C * 10000, 35.4e-6);
    close(10000 / 5.0e-3, 2.0e6);
  });
  it('6 µF and 3 µF in parallel on 18 V (solver and analytic)', () => {
    close(F.parallelC(6 * uF, 3 * uF), 9 * uF);
    const sim = settle(capParallelCircuit(18, 6 * uF, 3 * uF));
    close(sim.state.q.C1, 108 * uF);
    close(sim.state.q.C2, 54 * uF);
    const V = sim.state.V;
    close(V.u - V['0'], 18);
  });
  it('6 µF and 3 µF in series on 18 V (solver and analytic)', () => {
    close(F.seriesC(6 * uF, 3 * uF), 2 * uF);
    const sim = settle(capSeriesCircuit(18, 6 * uF, 3 * uF));
    close(sim.state.q.C1, 36 * uF);
    close(sim.state.q.C2, 36 * uF);
    const V = sim.state.V;
    close(V.u - V.i, 6.0);
    close(V.i - V['0'], 12.0);
  });
  it('network (3 ∥ 11 ∥ (12 series 6)) series 9 µF = 6 µF', () => {
    const spec = { s: [{ p: [3 * uF, 11 * uF, { s: [12 * uF, 6 * uF] }] }, 9 * uF] };
    close(F.seriesC(F.parallelC(3 * uF, 11 * uF, F.seriesC(12 * uF, 6 * uF)), 9 * uF), 6 * uF);
    const circuit = capNetworkCircuit(spec, 10);
    const sim = settle(circuit);
    const Q = circuit.elements.filter((e) => e.type === 'C' && e.a === 'A').reduce((s, e) => s + sim.state.q[e.id], 0);
    close(Q / 10, 6 * uF);
  });
  it('network ((1 ∥ 3) series 4) ∥ ((6 ∥ 2) series 8) = 6 µF', () => {
    const spec = { p: [{ s: [{ p: [1 * uF, 3 * uF] }, 4 * uF] }, { s: [{ p: [6 * uF, 2 * uF] }, 8 * uF] }] };
    close(F.parallelC(F.seriesC(F.parallelC(1 * uF, 3 * uF), 4 * uF), F.seriesC(F.parallelC(6 * uF, 2 * uF), 8 * uF)), 6 * uF);
    const circuit = capNetworkCircuit(spec, 10);
    const sim = settle(circuit);
    const Q = circuit.elements.filter((e) => e.type === 'C' && e.a === 'A').reduce((s, e) => s + sim.state.q[e.id], 0);
    close(Q / 10, 6 * uF);
  });
  it('charge sharing: 8 µF at 120 V joined to uncharged 4 µF', () => {
    const a = F.chargeSharing(8 * uF, 120, 4 * uF);
    close(a.Q, 960 * uF);
    close(a.Ui, 0.0576);
    close(a.V, 80);
    close(a.Q1, 640 * uF);
    close(a.Q2, 320 * uF);
    close(a.Uf, 0.0384);
    // Solver: charge flows through the wire until both are at the same height
    const sim = settle(chargeSharingCircuit(8 * uF, 120, 4 * uF, 1, true));
    close(sim.state.q.C1, 640 * uF);
    close(sim.state.q.C2, 320 * uF);
    const U = sim.storedEnergy();
    close(U.C1 + U.C2, 0.0384);
    // The missing energy was dissipated in the wire
    close(sim.energy.Rw, 0.0576 - 0.0384, 0.01);
  });
  it('energy density: 1.00 J/m³ needs 4.75×10⁵ V/m; 10× field gives 100 J/m³', () => {
    const E = F.fieldForEnergyDensity(1.0);
    close(E, 4.75e5);
    close(F.energyDensity(10 * E), 100);
  });
  it('clicker questions', () => {
    // C does not depend on Q: doubling Q doubles V
    const C = F.plateCapacitance(1, 1e-3);
    expect(C).toBe(F.plateCapacitance(1, 1e-3));
    // 12 µF series 6 µF = 4 µF, same charge on both
    close(F.seriesC(12 * uF, 6 * uF), 4 * uF);
    const sim = settle(capSeriesCircuit(6, 12 * uF, 6 * uF));
    close(sim.state.q.C1, 24 * uF);
    close(sim.state.q.C2, 24 * uF);
    // 12 µF ∥ 6 µF = 18 µF; if the 12 µF holds 24 µC (2 V), the 6 µF holds 12 µC
    close(F.parallelC(12 * uF, 6 * uF), 18 * uF);
    const sim2 = settle(capParallelCircuit(2, 12 * uF, 6 * uF));
    close(sim2.state.q.C1, 24 * uF);
    close(sim2.state.q.C2, 12 * uF);
  });
});

describe('Ch 27: DC circuits', () => {
  it('combination 8 + 4 + (6 ∥ 3) = 14.0 Ω, and every reduction stage draws the same current', () => {
    const full = combinationCircuit(42);
    close(equivalentResistance(full.elements, 'p', '0'), 14.0);
    const res = solveDC(full);
    close(res.I.B, 3.0);
    close(res.I.Rc, 1.0);
    close(res.I.Rd, 2.0);
    for (const stage of [1, 2, 3]) {
      const r = solveDC(combinationCircuit(42, undefined, stage));
      close(r.I.B, 3.0, 0.005, `stage ${stage}`);
    }
  });
  it('M1 defaults on 12 V', () => {
    close(solveDC(oneResistor(12, 3)).I.R1, 4.0);
    const par = solveDC(parallelCircuit(12, 3, 6));
    close(par.I.B, 6.0);
    close(par.I.R1, 4.0);
    close(par.I.R2, 2.0);
    close(12 / par.I.B, 2.0);
    const ser = solveDC(seriesCircuit(12, 3, 6));
    close(ser.I.B, 4 / 3);
    close(12 / ser.I.B, 9.0);
    close(ser.I.R1, ser.I.R2, 1e-9);
  });
  it('two-battery circuit (cannot be reduced)', () => {
    const res = solveDC(twoBatteryCircuit());
    expect(res.ok).toBe(true);
    close(res.V.t, 84 / 11);
    close(res.I.R1, 24 / 11);        // up into the top node
    close(res.I.R2, 21 / 11);        // down through the 4 Ω
    close(res.I.R3, 3 / 11);         // from the top node into the 6 V battery's + terminal
    close(res.I.B2, -3 / 11);        // so the 6 V battery is being charged
    close(res.I.R1, res.I.R2 + res.I.R3, 1e-9, 'KCL');
  });
  it('bulbs: two identical bulbs in series are equally bright; removing B gives A 4× the power', () => {
    const both = solveDC(bulbCircuit(12, 6, true));
    close(both.P.LA, both.P.LB, 1e-9);
    const one = solveDC(bulbCircuit(12, 6, false));
    close(one.P.LA / both.P.LA, 4.0);
    close(one.I.LA / both.I.LA, 2.0);
  });
});

describe('Ch 27: RC circuits', () => {
  it('RC Example 1: τ before and after closing; I_switch(t) = 200 µA + 100 µA·e^(−t/1.00 s)', () => {
    const open = rcExample1({}, false, 0);
    const est = estimateTimeConstants(open);
    close(est.tauMin, 1.5);
    // Charge from empty with the switch open, then close it mid-run (toggling a switch mid-transient)
    const sim = new Transient(open, { dt: 1.5 / 2000 });
    sim.runUntil(1.5);
    close(sim.state.q.C, 0.632 * 10e-6 * 10, 0.005, 'q(τ)');
    sim.runUntil(30);
    close(sim.state.q.C, 100e-6, 0.001, 'fully charged');
    open.elements.find((e) => e.id === 'S').closed = true;
    sim.rebuild();
    close(estimateTimeConstants(open).tauMin, 1.0);
    sim.setDt(1 / 2000);
    const t0 = sim.t;
    close(sim.state.I.S, 300e-6, 0.005, 'I_S(0+)');
    for (const t of [0.25, 0.5, 1, 2, 3]) {
      sim.runUntil(t0 + t);
      close(sim.state.I.S, 200e-6 + 100e-6 * Math.exp(-t / 1.0), 0.005, `I_S(${t})`);
    }
  });
  it('RC Example 2: steady state, then discharge after the switch opens', () => {
    const dc = solveDC(rcExample2({}, true));
    expect(dc.ok).toBe(true);
    close(dc.I.R1, 333.33e-6);
    close(dc.I.R2, 333.33e-6);
    expect(Math.abs(dc.I.R3)).toBeLessThan(1e-12);
    close(dc.V.c, 5.0);
    close(dc.q.C, 50e-6);
    const c = rcExample2({}, false, dc.q.C);
    close(estimateTimeConstants(c).tauMin, 0.18);
    const sim = new Transient(c, { dt: 0.18 / 4000 });
    close(sim.state.I.R2, 277.8e-6, 0.005, 'I_R2(0+)');
    for (const t of [0.05, 0.18, 0.4]) {
      sim.runUntil(t);
      close(sim.state.I.R2, 277.78e-6 * Math.exp(-t / 0.18), 0.005, `I_R2(${t})`);
    }
    // Time for the charge to fall to one fifth
    const sim2 = new Transient(rcExample2({}, false, 50e-6), { dt: 0.18 / 4000 });
    let prevQ = sim2.state.q.C; let prevT = 0;
    while (sim2.state.q.C > 10e-6) { prevQ = sim2.state.q.C; prevT = sim2.t; sim2.step(); }
    const tFifth = prevT + ((prevQ - 10e-6) / (prevQ - sim2.state.q.C)) * (sim2.t - prevT);
    close(tFifth, 0.290);
    close(0.18 * Math.log(5), 0.290);
  });
  it('generic RC: q(τ) = 0.632 Cε charging, 0.368 Q discharging, and energy balance', () => {
    const emf = 12; const R = 20e3; const C = 150e-6; const tau = R * C;
    const ch = new Transient(rcCircuit(emf, R, C, 'charge'), { dt: tau / 2000 });
    ch.runUntil(tau);
    close(ch.state.q.C, 0.632 * C * emf);
    close(ch.state.I.R, 0.368 * emf / R);
    ch.runUntil(20 * tau);
    const delivered = -ch.energy.B;
    const stored = ch.storedEnergy().C;
    close(delivered, C * emf * emf, 0.01, 'battery energy');
    close(stored, 0.5 * C * emf * emf, 0.01, 'stored');
    close(ch.energy.R, 0.5 * C * emf * emf, 0.01, 'dissipated');
    const dis = new Transient(rcCircuit(emf, R, C, 'discharge', C * emf), { dt: tau / 2000 });
    dis.runUntil(tau);
    close(dis.state.q.C, 0.368 * C * emf);
  });
});
