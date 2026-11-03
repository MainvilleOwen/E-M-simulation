// Every layout must satisfy Kirchhoff's junction rule at every endpoint, so the dots are conserved,
// and every wire's tint node must match the circuit nodes of the elements it touches.
import { describe, it, expect } from 'vitest';
import { solveDC, Transient, estimateTimeConstants } from '../../js/core/circuit.js';
import * as P from '../../js/content/presets.js';
import * as L from '../../js/content/layouts.js';

function stateFor(circuit) {
  const dc = solveDC(circuit);
  if (dc.ok && circuit.elements.every((e) => e.type !== 'C')) return dc;
  const est = estimateTimeConstants(circuit);
  const sim = new Transient(circuit, { dt: est.tauMin / 200 });
  sim.step(37); // mid-transient so capacitor currents are non-zero
  return sim.state;
}

function checkKCL(layout, circuit, label) {
  L.bindLayout(layout, circuit);
  const sol = stateFor(circuit);
  expect(sol.ok, `${label}: solve`).toBe(true);
  const net = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const add = (p, v) => net.set(key(p), (net.get(key(p)) || 0) + v);
  const nodeAt = new Map();
  const claim = (p, node, who) => {
    const k = key(p);
    if (nodeAt.has(k)) expect(nodeAt.get(k).node, `${label}: node mismatch at ${k} (${who} vs ${nodeAt.get(k).who})`).toBe(node);
    else nodeAt.set(k, { node, who });
  };
  for (const [id, el] of Object.entries(layout.elements)) {
    expect(el.ref, `${label}: layout element ${id} has no circuit element`).toBeTruthy();
    const I = sol.I[id];
    add(el.a, -I);
    add(el.b, I);
    claim(el.a, el.na, id);
    claim(el.b, el.nb, id);
  }
  let scale = 0;
  for (const w of layout.wires) {
    let I = 0;
    for (const [id, s] of w.flow) I += s * sol.I[id];
    add(w.pts[0], -I);
    add(w.pts[w.pts.length - 1], I);
    claim(w.pts[0], w.node, w.id);
    claim(w.pts[w.pts.length - 1], w.node, w.id);
    scale = Math.max(scale, Math.abs(I));
  }
  for (const [k, v] of net) {
    expect(Math.abs(v), `${label}: current not conserved at ${k}`).toBeLessThan(1e-4 * Math.max(scale, 1e-9) + 1e-12);
  }
  for (const p of layout.pieces || []) {
    const known = layout.elements[p.id] || layout.wires.find((w) => w.id === p.id);
    expect(known, `${label}: piece ${p.id}`).toBeTruthy();
  }
}

describe('layouts conserve current at every junction', () => {
  it('M1 layouts', () => {
    checkKCL(L.oneLayout(), P.oneResistor(12, 3), 'one');
    checkKCL(L.seriesLayout(), P.seriesCircuit(12, 3, 6), 'series');
    checkKCL(L.parallelLayout(true), P.parallelCircuit(12, 3, 6), 'parallel B');
    checkKCL(L.parallelLayout(false), P.oneResistor(12, 3), 'parallel A');
    for (const st of [0, 1, 2, 3]) checkKCL(L.combinationLayout(st), P.combinationCircuit(42, undefined, st), `combination ${st}`);
    checkKCL(L.bulbLayout(true), P.bulbCircuit(12, 6, true), 'bulbs');
    for (const sw of [true, false]) {
      checkKCL(L.oneLayout(true), P.oneResistor(12, 3, sw), `one sw=${sw}`);
      checkKCL(L.seriesLayout(true, true), P.seriesCircuit(12, 3, 6, sw), `series sw=${sw}`);
      checkKCL(L.seriesLayout(false, true), P.oneResistor(12, 3, sw), `series A sw=${sw}`);
      checkKCL(L.parallelLayout(true, true), P.parallelCircuit(12, 3, 6, sw), `parallel B sw=${sw}`);
      checkKCL(L.parallelLayout(false, true), P.oneResistor(12, 3, sw), `parallel A sw=${sw}`);
      checkKCL(L.bulbLayout(true, true), P.bulbCircuit(12, 6, true, sw), `bulbs sw=${sw}`);
      checkKCL(L.bulbLayout(false, true), P.bulbCircuit(12, 6, false, sw), `bulb A sw=${sw}`);
    }
    checkKCL(L.bulbLayout(false), P.bulbCircuit(12, 6, false), 'bulb A');
    checkKCL(L.twoBatteryLayout(), P.twoBatteryCircuit(), 'two-battery');
  });
  it('M2 layouts', () => {
    checkKCL(L.rcLayout(), P.rcCircuit(12, 20e3, 150e-6, 'charge'), 'rc charge');
    checkKCL(L.rcLayout(), P.rcCircuit(12, 20e3, 150e-6, 'discharge', 1e-3), 'rc discharge');
    checkKCL(L.rcExample1Layout(), P.rcExample1({}, false), 'ex1 open');
    checkKCL(L.rcExample1Layout(), P.rcExample1({}, true, 50e-6), 'ex1 closed');
    checkKCL(L.rcExample2Layout(), P.rcExample2({}, true), 'ex2 closed');
    checkKCL(L.rcExample2Layout(), P.rcExample2({}, false, 50e-6), 'ex2 open');
  });
  it('M3 layouts', () => {
    checkKCL(L.capSeriesLayout(), P.capSeriesCircuit(18, 6e-6, 3e-6), 'cap series');
    checkKCL(L.capParallelLayout(), P.capParallelCircuit(18, 6e-6, 3e-6), 'cap parallel');
    checkKCL(L.chargeSharingLayout(), P.chargeSharingCircuit(8e-6, 120, 4e-6, 1, true), 'sharing');
  });
  it('walk-the-loop routes are closed loops', () => {
    const layout = L.twoBatteryLayout();
    L.bindLayout(layout, P.twoBatteryCircuit());
    const ends = (id, rev) => {
      const el = layout.elements[id];
      const pts = el ? [el.a, el.b] : layout.wires.find((w) => w.id === id).pts;
      const s = pts[0]; const e = pts[pts.length - 1];
      return rev ? [e, s] : [s, e];
    };
    for (const [name, loop] of Object.entries(L.TWO_BATTERY_LOOPS)) {
      let cur = ends(...loop.steps[0])[0];
      const start = cur;
      for (const [id, rev] of loop.steps) {
        const [s, e] = ends(id, rev);
        expect(s, `${name}: ${id} starts where the previous piece ended`).toEqual(cur);
        cur = e;
      }
      expect(cur, `${name} closes`).toEqual(start);
    }
  });
});
