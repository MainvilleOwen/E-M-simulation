// Circuit builders for every preset and problem, plus slider ranges. Pure data, no DOM.
// The UI and the unit tests both use these, so the tests check exactly what the screens run.

// ---------- Slider ranges (single source of truth) ----------
export const RANGES = {
  emf: { min: 1, max: 24, step: 0.5, value: 12, unit: 'V' },
  R: { min: 1, max: 20, step: 0.5, value: 3, unit: 'Ω' },
  R2: { min: 1, max: 20, step: 0.5, value: 6, unit: 'Ω' },
  // RC charging (real time on screen at 1×: default τ = 20 kΩ × 150 µF = 3 s)
  rcR: { min: 5e3, max: 50e3, step: 1e3, value: 20e3, unit: 'Ω' },
  rcC: { min: 50e-6, max: 500e-6, step: 10e-6, value: 150e-6, unit: 'F' },
  rcEmf: { min: 1, max: 24, step: 0.5, value: 12, unit: 'V' },
  // Plate lab
  plateA: { min: 0.1, max: 4, step: 0.05, value: 2, unit: 'm²' },
  plateD: { min: 1e-3, max: 10e-3, step: 0.1e-3, value: 5e-3, unit: 'm' },
  plateV: { min: 1, max: 10000, step: 1, value: 10000, unit: 'V', log: true },
  // Series / parallel capacitors
  capC: { min: 1e-6, max: 12e-6, step: 0.5e-6, value: 6e-6, unit: 'F' },
  capC2: { min: 1e-6, max: 12e-6, step: 0.5e-6, value: 3e-6, unit: 'F' },
  capEmf: { min: 1, max: 24, step: 0.5, value: 18, unit: 'V' },
  // Charge sharing
  shareC1: { min: 1e-6, max: 12e-6, step: 0.5e-6, value: 8e-6, unit: 'F' },
  shareC2: { min: 1e-6, max: 12e-6, step: 0.5e-6, value: 4e-6, unit: 'F' },
  shareV: { min: 10, max: 200, step: 5, value: 120, unit: 'V' },
  shareRw: { min: 0.5, max: 5, step: 0.5, value: 1, unit: 'Ω' },
};

// ---------- M1: resistor circuits ----------

/** One battery (− at node 0, + at node 'p') and one resistor. */
export function oneResistor(emf, R) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'R', id: 'R1', a: 'p', b: '0', R },
    ],
  };
}

/** Battery, R1 then R2 in series. */
export function seriesCircuit(emf, R1, R2) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'R', id: 'R1', a: 'p', b: 'm', R: R1 },
      { type: 'R', id: 'R2', a: 'm', b: '0', R: R2 },
    ],
  };
}

/** Battery with R1 ∥ R2. */
export function parallelCircuit(emf, R1, R2) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'R', id: 'R1', a: 'p', b: '0', R: R1 },
      { type: 'R', id: 'R2', a: 'p', b: '0', R: R2 },
    ],
  };
}

/**
 * Combination from the slides: (Ra + Rb) in series with (Rc ∥ Rd). Default 8 + 4 + (6 ∥ 3) = 14 Ω.
 * stage 0: full circuit; 1: Ra+Rb merged to one resistor; 2: also Rc∥Rd merged; 3: everything merged.
 */
export function combinationCircuit(emf, { Ra = 8, Rb = 4, Rc = 6, Rd = 3 } = {}, stage = 0) {
  const els = [{ type: 'V', id: 'B', neg: '0', pos: 'p', V: emf }];
  if (stage >= 3) {
    els.push({ type: 'R', id: 'Req', a: 'p', b: '0', R: Ra + Rb + (Rc * Rd) / (Rc + Rd) });
    return { ground: '0', elements: els };
  }
  if (stage >= 1) els.push({ type: 'R', id: 'Rab', a: 'p', b: 'm', R: Ra + Rb });
  else els.push({ type: 'R', id: 'Ra', a: 'p', b: 'x', R: Ra }, { type: 'R', id: 'Rb', a: 'x', b: 'm', R: Rb });
  if (stage >= 2) els.push({ type: 'R', id: 'Rcd', a: 'm', b: '0', R: (Rc * Rd) / (Rc + Rd) });
  else els.push({ type: 'R', id: 'Rc', a: 'm', b: '0', R: Rc }, { type: 'R', id: 'Rd', a: 'm', b: '0', R: Rd });
  return { ground: '0', elements: els };
}

/** Bulbs: two identical bulbs in series (or one, with B replaced by a wire). */
export function bulbCircuit(emf, Rbulb, bothBulbs = true) {
  const els = [
    { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
    { type: 'R', id: 'LA', a: 'p', b: 'm', R: Rbulb },
  ];
  if (bothBulbs) els.push({ type: 'R', id: 'LB', a: 'm', b: '0', R: Rbulb });
  else els.push({ type: 'S', id: 'W', a: 'm', b: '0', closed: true });
  return { ground: '0', elements: els };
}

/**
 * Two-battery circuit that cannot be reduced. Bottom node '0', top node 't'.
 * Left: battery E1 (+ toward top) in series with R1. Middle: R2. Right: battery E2 (+ toward top) in series with R3.
 * Defaults: 12 V + 2 Ω, 4 Ω, 6 V + 6 Ω.
 */
export function twoBatteryCircuit({ E1 = 12, R1 = 2, R2 = 4, E2 = 6, R3 = 6 } = {}) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B1', neg: '0', pos: 'l', V: E1 },
      { type: 'R', id: 'R1', a: 'l', b: 't', R: R1 },
      { type: 'R', id: 'R2', a: 't', b: '0', R: R2 },
      { type: 'V', id: 'B2', neg: '0', pos: 'r', V: E2 },
      { type: 'R', id: 'R3', a: 't', b: 'r', R: R3 },
    ],
  };
}

// ---------- M2: RC circuits ----------

/**
 * RC with a two-way switch. 'charge': battery in the loop. 'discharge': battery bypassed by a wire.
 * Nodes: battery + at 'p'; switch common 'x'; R from x to 'y'; C from y to ground (plate a = top = y).
 */
export function rcCircuit(emf, R, C, position = 'charge', q0 = 0) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'S', id: 'Sc', a: 'p', b: 'x', closed: position === 'charge' },
      { type: 'S', id: 'Sd', a: 'x', b: '0', closed: position === 'discharge' },
      { type: 'R', id: 'R', a: 'x', b: 'y', R },
      { type: 'C', id: 'C', a: 'y', b: '0', C, q0 },
    ],
  };
}

/**
 * RC Example 1: ε, R1 and R2 along the top, C on the right, switch from the middle node down to the bottom rail.
 * Nodes: battery + 'p' → R1 → 'm' → R2 → 'y' → C → ground. Switch S: 'm' → ground.
 */
export function rcExample1({ emf = 10, R1 = 50e3, R2 = 100e3, C = 10e-6 } = {}, closed = false, q0 = 0) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'R', id: 'R1', a: 'p', b: 'm', R: R1 },
      { type: 'R', id: 'R2', a: 'm', b: 'y', R: R2 },
      { type: 'C', id: 'C', a: 'y', b: '0', C, q0 },
      { type: 'S', id: 'S', a: 'm', b: '0', closed },
    ],
  };
}

/**
 * RC Example 2: battery, switch and R1 in series to node 'a'; R2 from a to ground; R3 + C from a to ground.
 * Defaults 9.00 V, 12.0 kΩ, 15.0 kΩ, 3.00 kΩ, 10.0 µF.
 */
export function rcExample2({ emf = 9, R1 = 12e3, R2 = 15e3, R3 = 3e3, C = 10e-6 } = {}, closed = true, q0 = 0) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'S', id: 'S', a: 'p', b: 'q', closed },
      { type: 'R', id: 'R1', a: 'q', b: 'a', R: R1 },
      { type: 'R', id: 'R2', a: 'a', b: '0', R: R2 },
      { type: 'R', id: 'R3', a: 'a', b: 'c', R: R3 },
      { type: 'C', id: 'C', a: 'c', b: '0', C, q0 },
    ],
  };
}

// ---------- M3: capacitor circuits ----------
// Real wires have a little resistance; it sets how fast charge moves but not where it ends up.

export function capSeriesCircuit(emf, C1, C2, Rw = 1, closed = true) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'S', id: 'S', a: 'p', b: 'w', closed },
      { type: 'R', id: 'Rw', a: 'w', b: 'u', R: Rw },
      { type: 'C', id: 'C1', a: 'u', b: 'i', C: C1 },
      { type: 'C', id: 'C2', a: 'i', b: '0', C: C2 },
    ],
  };
}

export function capParallelCircuit(emf, C1, C2, Rw = 1, closed = true) {
  return {
    ground: '0',
    elements: [
      { type: 'V', id: 'B', neg: '0', pos: 'p', V: emf },
      { type: 'S', id: 'S', a: 'p', b: 'w', closed },
      { type: 'R', id: 'Rw', a: 'w', b: 'u', R: Rw },
      { type: 'C', id: 'C1', a: 'u', b: '0', C: C1 },
      { type: 'C', id: 'C2', a: 'u', b: '0', C: C2 },
    ],
  };
}

/** Charge sharing: C1 charged to V0, joined through wire resistance Rw to uncharged C2 when the switch closes. */
export function chargeSharingCircuit(C1, V0, C2, Rw = 1, closed = false) {
  return {
    ground: '0',
    elements: [
      { type: 'C', id: 'C1', a: 'u', b: '0', C: C1, q0: C1 * V0 },
      { type: 'S', id: 'S', a: 'u', b: 'w', closed },
      { type: 'R', id: 'Rw', a: 'w', b: 'v', R: Rw },
      { type: 'C', id: 'C2', a: 'v', b: '0', C: C2, q0: 0 },
    ],
  };
}

/**
 * A capacitor network between terminals 'A' and '0', described as nested series/parallel groups:
 * a number is a capacitor (farads); { s: [...] } is series; { p: [...] } is parallel.
 * Each series link gets a tiny wire resistance so a transient run can charge it.
 */
export function capNetworkCircuit(spec, emf = 10, Rw = 1) {
  const elements = [
    { type: 'V', id: 'B', neg: '0', pos: 'src', V: emf },
    { type: 'R', id: 'Rw', a: 'src', b: 'A', R: Rw },
  ];
  let n = 0;
  const node = () => `n${n++}`;
  let c = 0;
  const build = (s, a, b) => {
    if (typeof s === 'number') {
      elements.push({ type: 'C', id: `C${c++}`, a, b, C: s });
    } else if (s.s) {
      let from = a;
      s.s.forEach((part, i) => {
        const to = i === s.s.length - 1 ? b : node();
        build(part, from, to);
        from = to;
      });
    } else if (s.p) {
      for (const part of s.p) build(part, a, b);
    }
  };
  build(spec, 'A', '0');
  return { ground: '0', elements };
}
