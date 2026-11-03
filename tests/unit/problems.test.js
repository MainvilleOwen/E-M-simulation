// Solve-mode answers come from the solver at runtime; cross-check them against analytic formulas.
import { describe, it, expect } from 'vitest';
import { close } from './helpers.js';
import { CIRCUIT_PROBLEMS, RC_PROBLEMS, CAP_PROBLEMS, FIELD_PROBLEMS } from '../../js/content/problems.js';

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

describe('M3 problems', () => {
  const EPS0 = 8.8541878128e-12;
  it('plates: Example 2 key; variations match ε0A/d', () => {
    const pr = byId(CAP_PROBLEMS, 'plates');
    const a = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(a('C'), 3.54e-9); close(a('Q'), 35.4e-6); close(a('E'), 2.0e6);
    checkTexts(pr, pr.defaults);
    const rand = seeded(6);
    for (let i = 0; i < 50; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const C = (EPS0 * p.A) / p.d;
      close(pr.variation.answer({}, p).value, { C, Q: C * p.V, E: p.V / p.d }[p.ask], 1e-9);
    }
  });
  it('series capacitors: key (2 µF, 36 µC, 6 V, 12 V); variations match algebra', () => {
    const pr = byId(CAP_PROBLEMS, 'cap-series');
    const a = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(a('Ceq'), 2e-6); close(a('Q'), 36e-6); close(a('V2'), 12);
    checkTexts(pr, pr.defaults);
    const rand = seeded(7);
    for (let i = 0; i < 20; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const Ceq = (p.C1 * p.C2) / (p.C1 + p.C2);
      close(pr.variation.answer({}, p).value, { Ceq, Q: Ceq * p.emf, V2: (Ceq * p.emf) / p.C2 }[p.ask], 0.002);
    }
  });
  it('charge sharing: key (80 V, 38.4 mJ, 19.2 mJ heat); variations match algebra', () => {
    const pr = byId(CAP_PROBLEMS, 'sharing');
    const a = (ask) => pr.variation.answer({}, { ...pr.defaults, ask }).value;
    close(a('V'), 80); close(a('Uf'), 0.0384); close(a('heat'), 0.0192, 0.01);
    checkTexts(pr, pr.defaults);
    const rand = seeded(8);
    for (let i = 0; i < 20; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const V = (p.C1 * p.V0) / (p.C1 + p.C2);
      const Ui = 0.5 * p.C1 * p.V0 ** 2;
      const Uf = 0.5 * (p.C1 + p.C2) * V * V;
      close(pr.variation.answer({}, p).value, { V, Uf, heat: Ui - Uf }[p.ask], p.ask === 'heat' ? 0.01 : 0.002);
    }
  });
});

describe('M4 problems', () => {
  const k = 8.9875517923e9;
  it('superposition: like charges above the midpoint; variations match components', () => {
    const pr = byId(FIELD_PROBLEMS, 'superposition');
    // 2 nC at r = 5 cm: E = k q / r² each; x parts cancel, y parts add (4/5)
    close(pr.variation.answer({}, pr.defaults).value, 2 * ((k * 2e-9) / 0.05 ** 2) * 0.8);
    checkTexts(pr, pr.defaults);
    const rand = seeded(9);
    for (let i = 0; i < 100; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const r = Math.hypot(p.a, p.y);
      const e = (q, sx) => [(k * q) / r ** 2 * (sx * p.a) / r, (k * q) / r ** 2 * p.y / r];
      const [x1, y1] = e(p.q1, 1);
      const [x2, y2] = e(p.q2, -1);
      close(pr.variation.answer({}, p).value, Math.hypot(x1 + x2, y1 + y2), 1e-9);
    }
  });
  it('dipole: τ = pE sin θ and U = −pE cos θ', () => {
    const pr = byId(FIELD_PROBLEMS, 'dipole');
    close(pr.variation.answer({}, { ...pr.defaults, ask: 'tau' }).value, 1.0e-6);
    close(pr.variation.answer({}, { ...pr.defaults, ask: 'U' }).value, -4e-11 * 5e4 * Math.cos(Math.PI / 6));
    checkTexts(pr, pr.defaults);
    const rand = seeded(10);
    for (let i = 0; i < 50; i++) {
      const p = pr.variation.make(rand);
      checkTexts(pr, p);
      const th = (p.theta * Math.PI) / 180;
      const pm = p.q * p.d;
      close(pr.variation.answer({}, p).value, p.ask === 'tau' ? pm * p.E * Math.abs(Math.sin(th)) : -pm * p.E * Math.cos(th), 1e-9);
    }
  });
});
