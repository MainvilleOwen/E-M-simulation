// Solve-mode problems: statement, worked steps (each one sentence plus an action on the sim),
// and a variation generator. Every number shown is computed by the solver at runtime.
// Pure module (no DOM): `ctx` is supplied by each module's Solve view.
import { solveDC, equivalentResistance, Transient, estimateTimeConstants } from '../core/circuit.js';
import { formatSI } from '../core/format.js';
import { combinationCircuit, twoBatteryCircuit, oneResistor, rcExample1, rcExample2 } from './presets.js';

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
    statement: (p) => `<p>A ${p.emf} V battery drives R<sub>a</sub> = ${p.Ra} Ω and R<sub>b</sub> = ${p.Rb} Ω in series, followed by R<sub>c</sub> = ${p.Rc} Ω in parallel with R<sub>d</sub> = ${p.Rd} Ω.</p>
      <p>Find (a) the equivalent resistance, (b) the current from the battery, and (c) the current in R<sub>d</sub>.</p>`,
    setup: (ctx, p) => ctx.load('combination', p),
    steps: [
      {
        text: (p) => `R<sub>a</sub> and R<sub>b</sub> carry the same current (nothing branches off between them), so they are in series: ${p.Ra} Ω + ${p.Rb} Ω = ${f(combinationNumbers(p).Rab, 'Ω')}.`,
        act: (ctx) => ctx.reduce(1, ['Ra', 'Rb']),
      },
      {
        text: (p) => `R<sub>c</sub> and R<sub>d</sub> share the same top and bottom heights, so they are in parallel: (1/${p.Rc} + 1/${p.Rd})<sup>−1</sup> = ${f(combinationNumbers(p).Rcd, 'Ω')}.`,
        act: (ctx) => ctx.reduce(2, ['Rc', 'Rd']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `${f(n.Rab, 'Ω')} and ${f(n.Rcd, 'Ω')} are in series: R<sub>eq</sub> = ${f(n.Req, 'Ω')}.`; },
        act: (ctx) => ctx.reduce(3, ['Rab', 'Rcd']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `The battery current is I = ε / R<sub>eq</sub> = ${p.emf} V / ${f(n.Req, 'Ω')} = ${f(n.I, 'A')}. Every reduced circuit draws this same current.`; },
        act: (ctx) => ctx.highlight(['wA', 'wB']),
      },
      {
        text: (p) => { const n = combinationNumbers(p); return `Expand back: the parallel pair drops I × ${f(n.Rcd, 'Ω')} = ${f(n.Vcd, 'V')}, the same for both branches. So I<sub>d</sub> = ${f(n.Vcd, 'V')} / ${p.Rd} Ω = ${f(n.Id, 'A')} (and I<sub>c</sub> = ${f(n.Ic, 'A')}).`; },
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
        Id: `What is the current in R<sub>d</sub> = ${p.Rd} Ω?`,
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
        text: () => { return 'Junction rule at the top node (in = out): I<sub>1</sub> + I<sub>3</sub> = I<sub>2</sub>.'; },
        act: (ctx) => ctx.showJunction(true),
      },
      {
        text: (p) => { const n = twoBatteryNumbers(p); return `Solving gives V = ${f(n.V, 'V')}, so I<sub>2</sub> = ${f(n.I2, 'A')}. I<sub>3</sub> = ${f(n.I3up, 'A')}: ${n.I3up < 0 ? `negative, so it really flows down, into the + terminal of the ${p.E2} V battery. The magnitude is still right.` : 'positive, so the guess was right.'}`; },
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
