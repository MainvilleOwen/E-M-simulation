// Solve-mode problems: statement, worked steps (each one sentence plus an action on the sim),
// and a variation generator. Every number shown is computed by the solver at runtime.
// Pure module (no DOM): `ctx` is supplied by each module's Solve view.
import { solveDC, equivalentResistance } from '../core/circuit.js';
import { formatSI } from '../core/format.js';
import { combinationCircuit, twoBatteryCircuit, oneResistor } from './presets.js';

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
