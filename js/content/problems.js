// Solve-mode problems: statement, worked steps (each one sentence plus an action on the sim),
// and a variation generator. Every number shown is computed by the solver at runtime.
// Pure module (no DOM): `ctx` is supplied by each module's Solve view.
import { solveDC, equivalentResistance, Transient, estimateTimeConstants } from '../core/circuit.js';
import { formatSI, toSig, formatSci } from '../core/format.js';
import {
  combinationCircuit, twoBatteryCircuit, oneResistor, rcExample1, rcExample2,
  capSeriesCircuit, chargeSharingCircuit,
} from './presets.js';
import { plateCapacitance } from '../core/formulas.js';
import { fieldAt, fieldContributions, dipoleForces, dipoleEnergy, K } from '../core/fields.js';

const f = formatSI;
const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------------------
// M1: circuits
// ---------------------------------------------------------------------------

export function combinationNumbers(p) {
  const full = combinationCircuit(p.emf, p, 0);
  const sol = solveDC(full);
  const Req = equivalentResistance(full.elements, 'p', '0');
  const s2 = solveDC(combinationCircuit(p.emf, p, 2));
  return {
    Rab: p.Ra + p.Rb,
    Rcd: equivalentResistance([{ type: 'R', id: 'c', a: 'm', b: '0', R: p.Rc }, { type: 'R', id: 'd', a: 'm', b: '0', R: p.Rd }], 'm', '0'),
    Req,
    I: sol.I.B,
    Vcd: s2.V.m,
    Vab: s2.V.p - s2.V.m,
    Ic: sol.I.Rc,
    Id: sol.I.Rd,
  };
}

export function twoBatteryNumbers(p) {
  const sol = solveDC(twoBatteryCircuit(p));
  return { V: sol.V.t, I1: sol.I.R1, I2: sol.I.R2, I3up: -sol.I.R3, sol };
}

export const CIRCUIT_PROBLEMS = [
  {
    id: 'combination',
    title: 'Reduce a combination circuit',
    defaults: { emf: 42, Ra: 8, Rb: 4, Rc: 6, Rd: 3, ask: 'Id' },
    statement: (p) => `<p>A ${p.emf} V battery drives R<sub>1</sub> = ${p.Ra} Ω and R<sub>2</sub> = ${p.Rb} Ω in series, followed by R<sub>3</sub> = ${p.Rc} Ω in parallel with R<sub>4</sub> = ${p.Rd} Ω.</p>
      <p>Find (a) the equivalent resistance, (b) the current from the battery, and (c) the current in R<sub>4</sub>.</p>`,
    setup: (ctx, p) => ctx.load('combination', p),
    steps: [
      {
        text: (p) => `R<sub>1</sub> and R<sub>2</sub> carry the same current (nothing branches off between them), so they are in series: R<sub>12</sub> = ${p.Ra} Ω + ${p.Rb} Ω = ${f(combinationNumbers(p).Rab, 'Ω')}.`,
        act: (ctx) => ctx.reduce(1, ['Ra', 'Rb']),
      },
      {
        text: (p) => `R<sub>3</sub> and R<sub>4</sub> share the same top and bottom heights, so they are in parallel: R<sub>34</sub> = (1/${p.Rc} Ω + 1/${p.Rd} Ω)<sup>−1</sup> = ${f(combinationNumbers(p).Rcd, 'Ω')}.`,
        act: (ctx) => ctx.reduce(2, ['Rc', 'Rd']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `R<sub>12</sub> and R<sub>34</sub> are in series: R<sub>eq</sub> = ${f(n.Rab, 'Ω')} + ${f(n.Rcd, 'Ω')} = ${f(n.Req, 'Ω')}.`; },
        act: (ctx) => ctx.reduce(3, ['Rab', 'Rcd']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `The battery current is I = ε / R<sub>eq</sub> = ${p.emf} V / ${f(n.Req, 'Ω')} = ${f(n.I, 'A')}. Every reduced circuit draws this same current.`; },
        act: (ctx) => ctx.highlight(['wA', 'wB']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `Expand back: R<sub>34</sub> drops I × R<sub>34</sub> = ${f(n.Vcd, 'V')}, the same for R<sub>3</sub> and R<sub>4</sub>. So I<sub>4</sub> = ${f(n.Vcd, 'V')} / ${p.Rd} Ω = ${f(n.Id, 'A')} (and I<sub>3</sub> = ${f(n.Ic, 'A')}).`; },
        act: (ctx) => ctx.expand(0, ['Rd']),
      },
    ],
    variation: {
      make: (rand) => ({
        emf: pick(rand, [6, 9, 12, 18, 24, 36, 42, 48]),
        Ra: randInt(rand, 1, 12), Rb: randInt(rand, 1, 12), Rc: randInt(rand, 2, 12), Rd: randInt(rand, 2, 12),
        ask: pick(rand, ['Req', 'I', 'Id']),
      }),
      ask: (p) => ({
        Req: 'What is the equivalent resistance of the whole circuit?',
        I: 'What current does the battery deliver?',
        Id: `What is the current in R<sub>4</sub> = ${p.Rd} Ω?`,
      }[p.ask]),
      answer: (ctx, p) => {
        const n = combinationNumbers(p);
        if (p.ask === 'Req') return { value: n.Req, unit: 'Ω' };
        if (p.ask === 'I') return { value: n.I, unit: 'A' };
        return { value: n.Id, unit: 'A' };
      },
      revisit: (p) => ({ Req: 2, I: 3, Id: 4 }[p.ask]),
    },
  },
  {
    id: 'kirchhoff',
    title: 'Two batteries: Kirchhoff’s rules',
    defaults: { E1: 12, R1: 2, R2: 4, E2: 6, R3: 6 },
    statement: (p) => `<p>Three branches join a top node and a bottom node. Left: a ${p.E1} V battery (+ toward the top) in series with ${p.R1} Ω. Middle: ${p.R2} Ω. Right: a ${p.E2} V battery (+ toward the top) in series with ${p.R3} Ω.</p>
      <p>Find the current in the ${p.R2} Ω resistor and the direction of the current in the right branch.</p>`,
    setup: (ctx, p) => ctx.load('kirchhoff', p),
    steps: [
      {
        text: () => 'No two resistors here are simply in series or in parallel, because the batteries sit inside the branches. So call the bottom node 0 V and the top node V, and use Kirchhoff’s rules.',
        act: (ctx) => ctx.highlight(['wTL', 'wTR', 'wBL', 'wBR']),
      },
      {
        text: (p) => `Left branch, going up: the battery lifts charge by ${p.E1} V, then R<sub>1</sub> drops I<sub>1</sub>R<sub>1</sub>. So I<sub>1</sub> = (${p.E1} − V) / ${p.R1}.`,
        act: (ctx) => ctx.highlight(['B1', 'R1']),
      },
      {
        text: (p) => `Middle: I<sub>2</sub> = V / ${p.R2}. Right, guessing the current flows up: I<sub>3</sub> = (${p.E2} − V) / ${p.R3}.`,
        act: (ctx) => ctx.highlight(['R2', 'R3', 'B2']),
      },
      {
        text: (p) => { const n = twoBatteryNumbers(p); return `Junction rule at the top node (in = out): I<sub>1</sub> + I<sub>3</sub> = I<sub>2</sub>, so (${p.E1} − V)/${p.R1} + (${p.E2} − V)/${p.R3} = V/${p.R2}. Collect the V terms: V (1/${p.R1} + 1/${p.R2} + 1/${p.R3}) = ${p.E1}/${p.R1} + ${p.E2}/${p.R3}, so V = ${toSig(n.V, 3)} V.`; },
        act: (ctx) => ctx.showJunction(true),
      },
      {
        text: (p) => { const n = twoBatteryNumbers(p); return `So I<sub>2</sub> = V/${p.R2} = ${toSig(n.I2, 3)} A. I<sub>3</sub> = ${toSig(n.I3up, 3)} A: ${n.I3up < 0 ? `negative, so it really flows down, into the + terminal of the ${p.E2} V battery. The magnitude is still right.` : 'positive, so the guess was right.'}`; },
        act: (ctx) => ctx.showAssumed(true),
      },
    ],
    variation: {
      make: (rand) => {
        const E1 = randInt(rand, 6, 18);
        let E2 = randInt(rand, 2, 12);
        if (E2 === E1) E2 = Math.max(2, E1 - 3);
        return { E1, E2, R1: randInt(rand, 1, 10), R2: randInt(rand, 1, 10), R3: randInt(rand, 1, 10) };
      },
      ask: (p) => `What is the current in the middle ${p.R2} Ω resistor?`,
      answer: (ctx, p) => ({ value: twoBatteryNumbers(p).I2, unit: 'A' }),
      revisit: 3,
    },
  },
  {
    id: 'heater',
    title: 'Power in a heater (Example 26.4)',
    defaults: { V: 120, R: 8 },
    statement: (p) => `<p>An electric heater is connected across ${p.V} V. Its heating element has a resistance of ${f(p.R, 'Ω')}.</p><p>Find the current and the power delivered to the heater.</p>`,
    setup: (ctx, p) => ctx.load('heater', p),
    steps: [
      { text: (p) => `The heater is one resistor with the full ${p.V} V drop across it.`, act: (ctx) => ctx.highlight(['R1']) },
      { text: (p) => `Current: I = ΔV / R = ${p.V} V / ${f(p.R, 'Ω')} = ${f(solveDC(oneResistor(p.V, p.R)).I.R1, 'A')}.`, act: (ctx) => ctx.highlight(['w1', 'w2']) },
      {
        text: (p) => { const sol = solveDC(oneResistor(p.V, p.R)); return `Power: P = I ΔV = I<sup>2</sup>R = ${f(sol.P.R1, 'W')}.${p.V === 120 && p.R === 8 ? ' (The slide prints 1.8×10<sup>3</sup> kW; the correct value is 1.80 kW.)' : ''}`; },
        act: (ctx) => ctx.highlight(['R1']),
      },
    ],
    variation: {
      make: (rand) => ({ V: pick(rand, [110, 120, 220, 230, 240]), R: randInt(rand, 5, 40) }),
      ask: () => 'What power does the heater use?',
      answer: (ctx, p) => ({ value: solveDC(oneResistor(p.V, p.R)).P.R1, unit: 'W' }),
      revisit: 2,
    },
  },
];

// ---------------------------------------------------------------------------
// M2: RC circuits
// ---------------------------------------------------------------------------

const memo = (fn) => {
  const cache = new Map();
  return (p) => {
    const key = JSON.stringify(p);
    if (!cache.has(key)) { if (cache.size > 50) cache.clear(); cache.set(key, fn(p)); }
    return cache.get(key);
  };
};

/** RC Example 1 numbers, all from the solver. */
export const rcEx1Numbers = memo(rcEx1NumbersRaw);
function rcEx1NumbersRaw(p) {
  const open = rcExample1(p, false, 0);
  const tauBefore = estimateTimeConstants(open).tauMin;
  const full = solveDC(rcExample1(p, false, 0));
  const Q = full.q.C;
  const closedC = rcExample1(p, true, Q);
  const tauAfter = estimateTimeConstants(closedC).tauMin;
  const sim = new Transient(closedC, { dt: tauAfter / 400 });
  const Is0 = sim.state.I.S;
  const steady = solveDC(rcExample1(p, true, Q));
  const Ileft = steady.I.S; // long after closing only the battery loop carries current
  return { tauBefore, tauAfter, Q, Vc: Q / p.C, Is0, Ileft, Icap0: Is0 - Ileft };
}

/** RC Example 2 numbers, all from the solver. */
export const rcEx2Numbers = memo(rcEx2NumbersRaw);
function rcEx2NumbersRaw(p) {
  const dc = solveDC(rcExample2(p, true, 0));
  const Q = dc.q.C;
  const openC = rcExample2(p, false, Q);
  const tau = estimateTimeConstants(openC).tauMin;
  const sim = new Transient(openC, { dt: tau / 2000 });
  const IR2_0 = sim.state.I.R2;
  let prevQ = sim.state.q.C;
  let prevT = 0;
  while (sim.state.q.C > Q / 5 && sim.t < 20 * tau) { prevQ = sim.state.q.C; prevT = sim.t; sim.step(); }
  const tFifth = prevT + ((prevQ - Q / 5) / (prevQ - sim.state.q.C)) * (sim.t - prevT);
  return { I12: dc.I.R1, I3: dc.I.R3, Vc: dc.V.c, Q, tau, IR2_0, tFifth };
}

const kOhm = (x) => f(x, 'Ω');

export const RC_PROBLEMS = [
  {
    id: 'rc-ex1',
    title: 'RC Example 1: a switch across the middle',
    defaults: { emf: 10, R1: 50e3, R2: 100e3, C: 10e-6, ask: 'Is0' },
    statement: (p) => `<p>A ${f(p.emf, 'V')} battery, R<sub>1</sub> = ${kOhm(p.R1)} and R<sub>2</sub> = ${kOhm(p.R2)} run along the top to a ${f(p.C, 'F')} capacitor. A switch S connects the point between R<sub>1</sub> and R<sub>2</sub> to the bottom wire.</p>
      <p>(a) With S open, what is the charging time constant? (b) S has been open a long time and is then closed. What is the new time constant? (c) Find the current in the switch as a function of time.</p>`,
    setup: (ctx, p) => ctx.load('ex1', p),
    steps: [
      {
        text: (p) => `With S open there is one loop: battery, R<sub>1</sub>, R<sub>2</sub> and C. The capacitor charges through R<sub>1</sub> + R<sub>2</sub>: τ = (R<sub>1</sub> + R<sub>2</sub>)C = ${f(rcEx1Numbers(p).tauBefore, 's')}.`,
        act: (ctx) => ctx.chargeOpen(),
      },
      {
        text: (p) => { const n = rcEx1Numbers(p); return `After a long time the capacitor is full: Q = Cε = ${f(n.Q, 'C')}, V<sub>C</sub> = ${f(n.Vc, 'V')}, and no current flows.`; },
        act: (ctx) => ctx.full(),
      },
      {
        text: (p) => `Close S. The left loop (battery, R<sub>1</sub>, S) at once carries ε / R<sub>1</sub> = ${f(rcEx1Numbers(p).Ileft, 'A')} through the switch.`,
        act: (ctx) => ctx.closeSwitch(['B', 'R1', 'wP', 'wM1', 'wMs', 'S', 'wGs', 'wG2']),
      },
      {
        text: (p) => { const n = rcEx1Numbers(p); return `The right loop (C, R<sub>2</sub>, S) discharges with τ = R<sub>2</sub>C = ${f(n.tauAfter, 's')}, starting at V<sub>C</sub> / R<sub>2</sub> = ${f(n.Icap0, 'A')}.`; },
        act: (ctx) => ctx.highlight(['C', 'R2', 'wY', 'wM2', 'wMs', 'S', 'wGs', 'wG1']),
      },
      {
        text: (p) => { const n = rcEx1Numbers(p); return `Both currents run down through the switch: I<sub>S</sub>(t) = ${f(n.Ileft, 'A')} + (${f(n.Icap0, 'A')})·e<sup>−t/${f(n.tauAfter, 's')}</sup>.`; },
        act: (ctx) => ctx.highlight(['S']),
      },
    ],
    variation: {
      make: (rand) => ({
        emf: pick(rand, [6, 9, 10, 12, 15, 20]),
        R1: randInt(rand, 2, 20) * 10e3, R2: randInt(rand, 2, 20) * 10e3, C: pick(rand, [2, 4.7, 5, 10, 20, 22]) * 1e-6,
        ask: pick(rand, ['Is0', 'tauAfter', 'tauBefore']),
      }),
      ask: (p) => ({
        Is0: 'What is the current in the switch just after it closes?',
        tauAfter: 'What is the time constant after the switch closes?',
        tauBefore: 'What is the charging time constant with the switch open?',
      }[p.ask]),
      answer: (ctx, p) => {
        const n = rcEx1Numbers(p);
        return p.ask === 'Is0' ? { value: n.Is0, unit: 'A' } : { value: n[p.ask], unit: 's' };
      },
      revisit: (p) => ({ Is0: 4, tauAfter: 3, tauBefore: 0 }[p.ask]),
    },
  },
  {
    id: 'rc-ex2',
    title: 'RC Example 2: open the switch',
    defaults: { emf: 9, R1: 12e3, R2: 15e3, R3: 3e3, C: 10e-6, ask: 'tFifth' },
    statement: (p) => `<p>A ${f(p.emf, 'V')} battery and a switch drive R<sub>1</sub> = ${kOhm(p.R1)} into a node. From that node, R<sub>2</sub> = ${kOhm(p.R2)} goes to the bottom wire, and so does R<sub>3</sub> = ${kOhm(p.R3)} in series with C = ${f(p.C, 'F')}.</p>
      <p>(a) Long after the switch is closed, find the currents and the capacitor’s charge. (b) The switch is then opened. Find τ and the current in R<sub>2</sub> as a function of time. (c) How long until the charge falls to one fifth?</p>`,
    setup: (ctx, p) => ctx.load('ex2', p),
    steps: [
      { text: () => 'Long after closing, the capacitor is full and its branch carries no current: a full capacitor blocks steady current.', act: (ctx) => ctx.toSteady(['R3', 'C', 'wA3', 'wC', 'wG3']) },
      { text: (p) => { const n = rcEx2Numbers(p); return `So R<sub>1</sub> and R<sub>2</sub> are simply in series: I = ${f(p.emf, 'V')} / ${kOhm(p.R1 + p.R2)} = ${f(n.I12, 'A')}.`; }, act: (ctx) => ctx.highlight(['R1', 'R2']) },
      { text: (p) => { const n = rcEx2Numbers(p); return `The capacitor sits across R<sub>2</sub> (no drop in R<sub>3</sub>): V<sub>C</sub> = ${f(n.I12, 'A')} × ${kOhm(p.R2)} = ${f(n.Vc, 'V')}, so Q = CV<sub>C</sub> = ${f(n.Q, 'C')}.`; }, act: (ctx) => ctx.highlight(['C', 'R2']) },
      { text: (p) => `Open the switch. The battery is cut off, and the capacitor discharges through R<sub>3</sub> and R<sub>2</sub> in series: τ = (R<sub>2</sub> + R<sub>3</sub>)C = ${f(rcEx2Numbers(p).tau, 's')}.`, act: (ctx) => ctx.openSwitch(['C', 'R3', 'R2', 'wA2', 'wA3', 'wC', 'wG2', 'wG3']) },
      { text: (p) => { const n = rcEx2Numbers(p); return `I<sub>R2</sub>(t) = (V<sub>C</sub> / (R<sub>2</sub> + R<sub>3</sub>)) e<sup>−t/τ</sup> = ${f(n.IR2_0, 'A')}·e<sup>−t/${f(n.tau, 's')}</sup>.`; }, act: (ctx) => ctx.highlight(['R2']) },
      { text: (p) => { const n = rcEx2Numbers(p); return `One fifth of the charge: e<sup>−t/τ</sup> = 1/5, so t = τ ln 5 = ${f(n.tFifth, 's')}.`; }, act: (ctx) => ctx.markFifth() },
    ],
    variation: {
      make: (rand) => ({
        emf: pick(rand, [6, 9, 12, 15, 18]),
        R1: randInt(rand, 2, 30) * 1e3, R2: randInt(rand, 2, 30) * 1e3, R3: randInt(rand, 1, 10) * 1e3,
        C: pick(rand, [2.2, 4.7, 5, 10, 22]) * 1e-6,
        ask: pick(rand, ['tFifth', 'Vc', 'tau']),
      }),
      ask: (p) => ({
        tFifth: 'After the switch opens, how long until the charge falls to one fifth?',
        Vc: 'Long after the switch closes, what is the capacitor voltage?',
        tau: 'What is the time constant after the switch opens?',
      }[p.ask]),
      answer: (ctx, p) => {
        const n = rcEx2Numbers(p);
        return p.ask === 'Vc' ? { value: n.Vc, unit: 'V' } : { value: n[p.ask], unit: 's' };
      },
      revisit: (p) => ({ tFifth: 5, Vc: 2, tau: 3 }[p.ask]),
    },
  },
];

// ---------------------------------------------------------------------------
// M3: capacitors
// ---------------------------------------------------------------------------

/** Run a capacitor circuit to steady state with the transient solver. */
export function settleCircuit(circuit, taus = 30) {
  const est = estimateTimeConstants(circuit);
  const sim = new Transient(circuit, { dt: est.tauMin / 100 });
  sim.runUntil(est.tauMax * taus);
  return sim;
}

export const capSeriesNumbers = memo((p) => {
  const sim = settleCircuit(capSeriesCircuit(p.emf, p.C1, p.C2));
  const Q = sim.state.q.C1;
  return { Q, Ceq: Q / p.emf, V1: sim.state.V.u - sim.state.V.i, V2: sim.state.V.i, island: sim.state.q.C2 - sim.state.q.C1 };
});

export const sharingNumbers = memo((p) => {
  const sim = settleCircuit(chargeSharingCircuit(p.C1, p.V0, p.C2, 1, true));
  const U = sim.storedEnergy();
  const Ui = 0.5 * p.C1 * p.V0 * p.V0;
  return { V: sim.state.V.u, Q1: sim.state.q.C1, Q2: sim.state.q.C2, Q0: p.C1 * p.V0, Ui, Uf: U.C1 + U.C2, heat: sim.energy.Rw };
});

export function plateNumbers(p) {
  const C = plateCapacitance(p.A, p.d);
  return { C, Q: C * p.V, E: p.V / p.d, U: 0.5 * C * p.V * p.V };
}

export const CAP_PROBLEMS = [
  {
    id: 'plates',
    title: 'Parallel plates (Ch 25 Example 2)',
    defaults: { A: 2, d: 5e-3, V: 10000, ask: 'C' },
    statement: (p) => `<p>A parallel-plate capacitor has plates of area ${f(p.A, 'm²')} separated by ${f(p.d, 'm')} of vacuum, and is connected to ${f(p.V, 'V')}.</p><p>Find (a) the capacitance, (b) the charge on each plate, and (c) the field between the plates.</p>`,
    setup: (ctx, p) => ctx.load('plates', p),
    steps: [
      { text: (p) => `Capacitance depends only on the geometry: C = ε<sub>0</sub>A / d = (8.85×10<sup>−12</sup> F/m)(${toSig(p.A, 3)} m²) / (${formatSci(p.d, 'm')}) = ${f(plateNumbers(p).C, 'F')}.`, act: (ctx) => ctx.highlight('C') },
      { text: (p) => `The battery moves charge until the plates are ${f(p.V, 'V')} apart in height: Q = CV = ${f(plateNumbers(p).Q, 'C')}.`, act: (ctx) => ctx.highlight('Q') },
      { text: (p) => `The field between the plates is uniform: E = V / d = ${f(plateNumbers(p).E, 'V/m')}.`, act: (ctx) => ctx.highlight('E') },
    ],
    variation: {
      make: (rand) => ({
        A: pick(rand, [0.5, 1, 1.5, 2, 2.5, 3]), d: pick(rand, [1, 2, 2.5, 4, 5, 8]) * 1e-3, V: pick(rand, [100, 500, 1000, 2000, 5000]),
        ask: pick(rand, ['C', 'Q', 'E']),
      }),
      ask: (p) => ({ C: 'What is the capacitance?', Q: 'What charge sits on the positive plate?', E: 'What is the field between the plates?' }[p.ask]),
      answer: (ctx, p) => { const n = plateNumbers(p); return { value: n[p.ask], unit: { C: 'F', Q: 'C', E: 'V/m' }[p.ask] }; },
      revisit: (p) => ({ C: 0, Q: 1, E: 2 }[p.ask]),
    },
  },
  {
    id: 'cap-series',
    title: 'Two capacitors in series',
    defaults: { C1: 6e-6, C2: 3e-6, emf: 18, ask: 'V2' },
    statement: (p) => `<p>Capacitors C<sub>1</sub> = ${f(p.C1, 'F')} and C<sub>2</sub> = ${f(p.C2, 'F')} are connected in series across ${f(p.emf, 'V')}.</p><p>Find the equivalent capacitance, the charge on each, and the voltage across each.</p>`,
    setup: (ctx, p) => ctx.load('series', p),
    steps: [
      { text: () => 'The inner plates and the wire between them form an isolated island: its total charge stays zero.', act: (ctx) => ctx.island() },
      { text: () => 'So when the battery puts +Q on C<sub>1</sub>’s outer plate, −Q gathers on its inner plate, leaving +Q on C<sub>2</sub>’s inner plate. Both carry the same charge.', act: (ctx) => ctx.charge() },
      { text: (p) => `In series the steps add: 1/C<sub>eq</sub> = 1/C<sub>1</sub> + 1/C<sub>2</sub>, so C<sub>eq</sub> = ${f(capSeriesNumbers(p).Ceq, 'F')} and Q = C<sub>eq</sub>ε = ${f(capSeriesNumbers(p).Q, 'C')}.`, act: (ctx) => ctx.highlight(['C1', 'C2']) },
      { text: (p) => { const n = capSeriesNumbers(p); return `The voltages split as Q/C: V<sub>1</sub> = ${f(n.V1, 'V')} and V<sub>2</sub> = ${f(n.V2, 'V')}. The smaller capacitor gets the bigger step.`; }, act: (ctx) => ctx.highlight(['C2']) },
    ],
    variation: {
      make: (rand) => ({ C1: pick(rand, [1, 2, 3, 4, 5, 6, 8, 10, 12]) * 1e-6, C2: pick(rand, [1, 2, 3, 4, 5, 6, 8, 10, 12]) * 1e-6, emf: pick(rand, [6, 9, 12, 18, 24]), ask: pick(rand, ['Q', 'V2', 'Ceq']) }),
      ask: (p) => ({ Q: 'What charge does each capacitor hold?', V2: `What is the voltage across C<sub>2</sub> = ${f(p.C2, 'F')}?`, Ceq: 'What is the equivalent capacitance?' }[p.ask]),
      answer: (ctx, p) => { const n = capSeriesNumbers(p); return { value: n[p.ask], unit: { Q: 'C', V2: 'V', Ceq: 'F' }[p.ask] }; },
      revisit: (p) => ({ Q: 2, V2: 3, Ceq: 2 }[p.ask]),
    },
  },
  {
    id: 'sharing',
    title: 'Charge sharing: where did the energy go?',
    defaults: { C1: 8e-6, V0: 120, C2: 4e-6, ask: 'V' },
    statement: (p) => `<p>Capacitor C<sub>1</sub> = ${f(p.C1, 'F')} is charged to ${f(p.V0, 'V')}, disconnected, and then connected to an uncharged capacitor C<sub>2</sub> = ${f(p.C2, 'F')}.</p><p>Find the final voltage, the charge on each, and the energy before and after.</p>`,
    setup: (ctx, p) => ctx.load('sharing', p),
    steps: [
      { text: (p) => `Before: Q<sub>0</sub> = C<sub>1</sub>V<sub>0</sub> = ${f(sharingNumbers(p).Q0, 'C')} and U<sub>i</sub> = ½C<sub>1</sub>V<sub>0</sub><sup>2</sup> = ${f(sharingNumbers(p).Ui, 'J')}.`, act: (ctx) => ctx.highlight(['C1']) },
      { text: () => 'Close the switch. Charge flows from the high plate to the low plate until both tops are at the same height.', act: (ctx) => ctx.run() },
      { text: (p) => { const n = sharingNumbers(p); return `Charge is conserved: V = Q<sub>0</sub> / (C<sub>1</sub> + C<sub>2</sub>) = ${f(n.V, 'V')}, so Q<sub>1</sub> = ${f(n.Q1, 'C')} and Q<sub>2</sub> = ${f(n.Q2, 'C')}.`; }, act: (ctx) => ctx.highlight(['C1', 'C2']) },
      { text: (p) => { const n = sharingNumbers(p); return `After: U<sub>f</sub> = ½(C<sub>1</sub> + C<sub>2</sub>)V<sup>2</sup> = ${f(n.Uf, 'J')}. The missing ${f(n.Ui - n.Uf, 'J')} was dissipated in the connecting wire while the charge flowed.`; }, act: (ctx) => ctx.highlight(['Rw']) },
    ],
    variation: {
      make: (rand) => ({ C1: pick(rand, [2, 4, 5, 6, 8, 10]) * 1e-6, V0: pick(rand, [24, 50, 60, 100, 120, 150]), C2: pick(rand, [1, 2, 3, 4, 6, 8]) * 1e-6, ask: pick(rand, ['V', 'Uf', 'heat']) }),
      ask: (p) => ({ V: 'What is the final voltage?', Uf: 'What is the total stored energy afterwards?', heat: 'How much energy is dissipated in the wire?' }[p.ask]),
      answer: (ctx, p) => { const n = sharingNumbers(p); return { value: n[p.ask], unit: p.ask === 'V' ? 'V' : 'J' }; },
      revisit: (p) => ({ V: 2, Uf: 3, heat: 3 }[p.ask]),
    },
  },
];

// ---------------------------------------------------------------------------
// M4: fields and dipoles
// ---------------------------------------------------------------------------

/** Field at P = (0, y) from q1 at (−a, 0) and q2 at (+a, 0). Positions in m, charges in C. */
export function superpositionNumbers(p) {
  const charges = [{ x: -p.a, y: 0, q: p.q1 }, { x: p.a, y: 0, q: p.q2 }];
  const parts = fieldContributions(charges, 0, p.y);
  const E = fieldAt(charges, 0, p.y);
  const r = Math.hypot(p.a, p.y);
  return { charges, r, E1: Math.hypot(parts[0].Ex, parts[0].Ey), E2: Math.hypot(parts[1].Ex, parts[1].Ey), Ex: E.Ex, Ey: E.Ey, E: Math.hypot(E.Ex, E.Ey) };
}

export function dipoleNumbers(p) {
  const th = (p.theta * Math.PI) / 180;
  const fz = dipoleForces(p.q, p.d, p.E, th);
  return { p: p.q * p.d, F: p.q * p.E, net: Math.hypot(fz.net.x, fz.net.y), tau: Math.abs(fz.torque), U: dipoleEnergy(p.q * p.d, p.E, th) };
}

const cm = (m) => `${formatSI(m * 100, '', { sig: 3 }).trim()} cm`;
const nC = (q) => `${q > 0 ? '+' : '−'}${formatSI(Math.abs(q) * 1e9, '', { sig: 3 }).trim()} nC`;

export const FIELD_PROBLEMS = [
  {
    id: 'superposition',
    title: 'Superposition: field at a point',
    defaults: { q1: 2e-9, q2: 2e-9, a: 0.03, y: 0.04 },
    statement: (p) => `<p>Charge q<sub>1</sub> = ${nC(p.q1)} sits at (−${cm(p.a)}, 0) and q<sub>2</sub> = ${nC(p.q2)} at (+${cm(p.a)}, 0).</p><p>Find the magnitude of the electric field at P = (0, ${cm(p.y)}).</p>`,
    setup: (ctx, p) => ctx.load('superposition', p),
    steps: [
      { text: (p) => `Each charge is r = √((${cm(p.a)})² + (${cm(p.y)})²) = ${cm(superpositionNumbers(p).r)} from P.`, act: (ctx) => ctx.show('distance') },
      { text: (p) => { const n = superpositionNumbers(p); return `Each one alone: E = k|q|/r². E<sub>1</sub> = ${f(n.E1, 'N/C')} ${p.q1 > 0 ? 'away from' : 'toward'} q<sub>1</sub>; E<sub>2</sub> = ${f(n.E2, 'N/C')} ${p.q2 > 0 ? 'away from' : 'toward'} q<sub>2</sub>.`; }, act: (ctx) => ctx.show('parts') },
      { text: (p) => { const n = superpositionNumbers(p); return `Add them as vectors, component by component: E<sub>x</sub> = ${f(n.Ex, 'N/C')}, E<sub>y</sub> = ${f(n.Ey, 'N/C')}.`; }, act: (ctx) => ctx.show('sum') },
      { text: (p) => `|E| = √(E<sub>x</sub>² + E<sub>y</sub>²) = ${f(superpositionNumbers(p).E, 'N/C')}.`, act: (ctx) => ctx.show('sum') },
    ],
    variation: {
      make: (rand) => ({
        q1: pick(rand, [1, 2, 3, 4, 5]) * 1e-9 * (rand() < 0.5 ? -1 : 1),
        q2: pick(rand, [1, 2, 3, 4, 5]) * 1e-9 * (rand() < 0.5 ? -1 : 1),
        a: pick(rand, [2, 3, 4, 5]) * 1e-2, y: pick(rand, [2, 3, 4, 5, 6]) * 1e-2,
      }),
      ask: () => 'What is the magnitude of the field at P?',
      answer: (ctx, p) => ({ value: superpositionNumbers(p).E, unit: 'N/C' }),
      revisit: 2,
    },
  },
  {
    id: 'dipole',
    title: 'A dipole in a uniform field',
    defaults: { q: 2e-9, d: 0.02, E: 5e4, theta: 30, ask: 'tau' },
    statement: (p) => `<p>A dipole is made of ±${formatSI(p.q * 1e9, '', { sig: 3 }).trim()} nC charges ${cm(p.d)} apart. It sits in a uniform field of ${f(p.E, 'N/C')}, with its dipole moment at θ = ${p.theta}° to the field.</p><p>Find the net force, the torque, and the potential energy.</p>`,
    setup: (ctx, p) => ctx.load('dipole', p),
    steps: [
      { text: (p) => `Dipole moment: p = qd = ${f(dipoleNumbers(p).p, 'C·m')}.`, act: (ctx) => ctx.show('p') },
      { text: (p) => `The forces are +qE and −qE: equal (${f(dipoleNumbers(p).F, 'N')}) and opposite, so the net force is zero.`, act: (ctx) => ctx.show('forces') },
      { text: (p) => `But they do not act along the same line, so they twist it: τ = pE sin θ = ${f(dipoleNumbers(p).tau, 'N·m')}.`, act: (ctx) => ctx.show('torque') },
      { text: (p) => `Potential energy: U = −pE cos θ = ${f(dipoleNumbers(p).U, 'J')}. It is lowest when the dipole lines up with the field.`, act: (ctx) => ctx.show('release') },
    ],
    variation: {
      make: (rand) => ({ q: pick(rand, [1, 2, 3, 5]) * 1e-9, d: pick(rand, [1, 2, 3, 4]) * 1e-2, E: pick(rand, [1, 2, 5, 8]) * 1e4, theta: pick(rand, [20, 30, 45, 60, 120, 150]), ask: pick(rand, ['tau', 'U']) }),
      ask: (p) => (p.ask === 'tau' ? 'What is the size of the torque on the dipole?' : 'What is the potential energy U = −pE cos θ? (Include the sign.)'),
      answer: (ctx, p) => { const n = dipoleNumbers(p); return p.ask === 'tau' ? { value: n.tau, unit: 'N·m' } : { value: n.U, unit: 'J' }; },
      revisit: (p) => (p.ask === 'tau' ? 2 : 3),
    },
  },
];
void K;
