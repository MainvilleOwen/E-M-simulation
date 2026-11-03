// Solve-mode answers come from the solver at runtime; cross-check them against analytic formulas.
import { describe, it, expect } from 'vitest';
import { close } from './helpers.js';
import { CIRCUIT_PROBLEMS, RC_PROBLEMS } from '../../js/content/problems.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const byId = (list, id) => list.find((p) => p.id === id);

/** Every step text and the statement render without NaN/undefined for these params. */
function checkTexts(problem, p) {
  const ctx = {};
  const all = [problem.statement(p), ...problem.steps.map((s) => s.text(p, ctx))];
  if (problem.variation) all.push(problem.variation.ask(p));
  for (const t of all) expect(t).not.toMatch(/NaN|undefined|Infinity/);
}

describe('M1 problems', () => {
  it('combination: defaults match the key, variations match series/parallel algebra', () => {
    const pr = byId(CIRCUIT_PROBLEMS, 'combination');
    const ans = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(ans('Req'), 14);
    close(ans('I'), 3);
    close(ans('Id'), 2);
    checkTexts(pr, pr.defaults);
    const rand = seeded(1);
    for (let i = 0; i < 200; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const Rcd = (p.Rc * p.Rd) / (p.Rc + p.Rd);
      const Req = p.Ra + p.Rb + Rcd;
      const I = p.emf / Req;
      const expected = { Req, I, Id: (I * Rcd) / p.Rd }[p.ask];
      close(pr.variation.answer({}, p).value, expected, 1e-6);
    }
  });
  it('two batteries: defaults match the key, variations match the node equation', () => {
    const pr = byId(CIRCUIT_PROBLEMS, 'kirchhoff');
    close(pr.variation.answer({}, pr.defaults).value, 21 / 11);
    checkTexts(pr, pr.defaults);
    const rand = seeded(2);
    for (let i = 0; i < 200; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const V = (p.E1 / p.R1 + p.E2 / p.R3) / (1 / p.R1 + 1 / p.R2 + 1 / p.R3);
      close(pr.variation.answer({}, p).value, V / p.R2, 1e-6);
    }
  });
  it('heater: 1.80 kW at the defaults, P = V²/R for variations', () => {
    const pr = byId(CIRCUIT_PROBLEMS, 'heater');
    close(pr.variation.answer({}, pr.defaults).value, 1800);
    checkTexts(pr, pr.defaults);
    const rand = seeded(3);
    for (let i = 0; i < 100; i++) {
      const p = pr.variation.make(rand);
      close(pr.variation.answer({}, p).value, (p.V * p.V) / p.R, 1e-6);
    }
  });
});

describe('M2 problems', () => {
  it('RC Example 1 matches the key; variations match RC algebra', () => {
    const pr = byId(RC_PROBLEMS, 'rc-ex1');
    const a = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(a('tauBefore'), 1.5);
    close(a('tauAfter'), 1.0);
    close(a('Is0'), 300e-6);
    checkTexts(pr, pr.defaults);
    const rand = seeded(4);
    for (let i = 0; i < 40; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const expected = { tauBefore: (p.R1 + p.R2) * p.C, tauAfter: p.R2 * p.C, Is0: p.emf / p.R1 + p.emf / p.R2 }[p.ask];
      close(pr.variation.answer({}, p).value, expected, 0.002);
    }
  });
  it('RC Example 2 matches the key; variations match RC algebra', () => {
    const pr = byId(RC_PROBLEMS, 'rc-ex2');
    const a = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(a('tFifth'), 0.290);
    close(a('Vc'), 5.0);
    close(a('tau'), 0.18);
    checkTexts(pr, pr.defaults);
    const rand = seeded(5);
    for (let i = 0; i < 40; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const tau = (p.R2 + p.R3) * p.C;
      const expected = { tau, Vc: (p.emf * p.R2) / (p.R1 + p.R2), tFifth: tau * Math.log(5) }[p.ask];
      close(pr.variation.answer({}, p).value, expected, 0.003);
    }
  });
});
