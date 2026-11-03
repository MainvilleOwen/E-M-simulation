// Hidden #/kitchen-sink page: every UI kit component wired to the real physics core.
import { h } from '../ui/dom.js';
import { moduleShell, viewBody, ctrlCard } from '../ui/module-shell.js';
import { CircuitView, bindLayout } from '../ui/circuit-view.js';
import { slider, segmented, readouts, equationReveal, linkSymbols } from '../ui/controls.js';
import { LivePlot } from '../ui/plot.js';
import { compareLayout } from '../ui/compare.js';
import { predictCard } from '../ui/predict.js';
import { solveRunner } from '../ui/solve-runner.js';
import { TransientRunner } from '../ui/transient-runner.js';
import { solveDC } from '../core/circuit.js';
import { formatSI } from '../core/format.js';
import { seriesCircuit, parallelCircuit, oneResistor, rcCircuit } from '../content/presets.js';
import { seriesLayout, parallelLayout, rcLayout } from '../content/layouts.js';

export function mount(root, life) {
  const shell = moduleShell(root, life, {
    route: 'kitchen-sink',
    title: 'Kitchen sink',
    question: 'Every UI component, driven by the physics core.',
    views: [{ id: 'all', label: 'All components', mount: mountAll }],
  });
  return shell;
}

function mountAll(container, life) {
  linkSymbols(container, life);

  // 1. Circuit view: series
  const s1 = h('section', { class: 'ks-section', id: 'ks-series' }, h('h2', {}, 'Circuit view (series)'));
  container.appendChild(s1);
  const { sim, ctrl } = viewBody(s1);
  const scales = { vMin: 0, vMax: 12, dotK: 12, vmax: 60, pushPerVolt: 1.6, pRef: 20 };
  let R1 = 3; let R2 = 6;
  let circuit = seriesCircuit(12, R1, R2);
  const layout = bindLayout(seriesLayout(), circuit);
  const view = new CircuitView(sim, life, { layout, pieces: layout.pieces, scales, dotsNote: true });
  const ro = readouts([
    { key: 'I', label: 'Current <i>I</i>', unit: 'A', sym: 'I' },
    { key: 'Req', label: '<i>R</i><sub>eq</sub>', unit: 'Ω', sym: 'Req' },
    { key: 'V1', label: 'Drop across R<sub>1</sub>', unit: 'V' },
    { key: 'V2', label: 'Drop across R<sub>2</sub>', unit: 'V' },
  ]);
  const solve = () => {
    circuit = seriesCircuit(12, R1, R2);
    bindLayout(layout, circuit);
    const sol = solveDC(circuit);
    view.setSolution(sol);
    if (sol.ok) {
      ro.set('I', sol.I.B); ro.set('Req', 12 / sol.I.B);
      ro.set('V1', sol.V.p - sol.V.m); ro.set('V2', sol.V.m);
      view.set({ labels: { B: '12 V', R1: `R₁ = ${formatSI(R1, 'Ω')}`, R2: `R₂ = ${formatSI(R2, 'Ω')}` }, hmLabels: { B: 'ε', R1: 'R₁', R2: 'R₂' } });
    }
  };
  const sR1 = slider({ label: 'R<sub>1</sub>', sym: 'R1', min: 1, max: 20, step: 0.5, value: R1, unit: 'Ω', onInput: (v) => { R1 = v; solve(); } });
  const sR2 = slider({ label: 'R<sub>2</sub>', sym: 'R2', min: 1, max: 20, step: 0.5, value: R2, unit: 'Ω', onInput: (v) => { R2 = v; solve(); } });
  const eq = equationReveal('<span class="sym" data-sym="I"><i>I</i></span> = ε / (<span class="sym" data-sym="R1"><i>R</i><sub>1</sub></span> + <span class="sym" data-sym="R2"><i>R</i><sub>2</sub></span>)');
  ctrlCard(ctrl, 'Sliders', sR1.el, sR2.el);
  ctrlCard(ctrl, 'Readouts', ro.el, eq.el);
  const seg = segmented({ label: 'Toggle demo', value: 'on', options: [{ value: 'on', label: 'Push arrows on' }, { value: 'off', label: 'Off' }], onChange: (v) => { scales.pushPerVolt = v === 'on' ? 1.6 : 0; } });
  ctrlCard(ctrl, 'Toggle', seg.el);
  solve();

  // 2. Compare + predict
  const s2 = h('section', { class: 'ks-section', id: 'ks-compare' }, h('h2', {}, 'Compare + predict'));
  container.appendChild(s2);
  const cmpScales = { vMin: 0, vMax: 12, dotK: 9, vmax: 60, pushPerVolt: 1.6 };
  const cmp = compareLayout(s2, { a: 'R₁ alone', b: 'R₁ ∥ R₂' });
  const cA = oneResistor(12, 3);
  const cB = parallelCircuit(12, 3, 6);
  const lA = bindLayout(parallelLayout(false), cA);
  const lB = bindLayout(parallelLayout(true), cB);
  const vA = new CircuitView(cmp.a, life, { layout: lA, pieces: lA.pieces, scales: cmpScales, hmMax: 150 });
  const vB = new CircuitView(cmp.b, life, { layout: lB, pieces: lB.pieces, scales: cmpScales, hmMax: 150 });
  let running = false;
  const setCompare = () => {
    const sa = solveDC(cA); const sb = solveDC(cB);
    vA.setSolution(running ? sa : { ...sa, I: zeroI(sa.I) });
    vB.setSolution(running ? sb : { ...sb, I: zeroI(sb.I) });
  };
  const card = predictCard({
    prompt: 'Add R₂ in parallel. Does the battery current go up, down, or stay the same?',
    options: [{ id: 'up', label: 'Up' }, { id: 'down', label: 'Down' }, { id: 'same', label: 'Same' }],
    correct: 'up',
    delay: 600,
    onPick: () => { running = true; setCompare(); },
    explain: () => 'R₁ still has the full 12 V drop, so it carries the same 4 A as in A. R₂ adds a second lane with 2 A. Total: 6 A.',
    onReset: () => { running = false; setCompare(); },
  });
  life.add(() => card.destroy());
  s2.insertBefore(card.el, cmp.el);
  setCompare();

  // 3. Live plot with ghost
  const s3 = h('section', { class: 'ks-section', id: 'ks-plot' }, h('h2', {}, 'Live plot with ghost (RC charging)'));
  container.appendChild(s3);
  const plotWrap = h('div', { class: 'plots' });
  s3.appendChild(plotWrap);
  const plot = new LivePlot(plotWrap, life, { title: 'q(t)', unit: 'C', sym: 'q' });
  let rcR = 20e3; const rcC = 150e-6;
  const runner = new TransientRunner({ timeScale: 4, onSample: (st) => plot.push(st.t, st.q.C) });
  const rcView = new CircuitView(s3, life, { layout: bindLayout(rcLayout(), rcCircuit(12, rcR, rcC)), pieces: rcLayout().pieces, scales: { vMin: 0, vMax: 12, dotK: 40000, vmax: 60, qPerMark: 1.8e-4 / 12 * 1.0 } });
  const startRC = (keepGhost) => {
    const c = rcCircuit(12, rcR, rcC);
    const lay = bindLayout(rcLayout(), c);
    rcView.setLayout(lay, lay.pieces);
    runner.load(c);
    runner.playing = true;
    runner.tEnd = 5 * 50e3 * rcC;
    plot.reset({ keepGhost });
    const tau = rcR * rcC;
    plot.setAxes({ tMax: 5 * 50e3 * rcC, yMax: rcC * 12 * 1.05 });
    plot.setMarkers([{ type: 'v', at: tau, label: 'τ = RC' }, { type: 'h', at: 0.632 * rcC * 12, label: '63%' }]);
    plot.push(0, 0);
  };
  const sR = slider({ label: 'R', sym: 'R', min: 5e3, max: 50e3, step: 1e3, value: rcR, unit: 'Ω', onInput: (v) => { rcR = v; startRC(true); } });
  s3.appendChild(h('div', { class: 'ctrl-card' }, sR.el));
  startRC(false);

  // 4. Solve runner
  const s4 = h('section', { class: 'ks-section', id: 'ks-solve' }, h('h2', {}, 'Solve runner'));
  container.appendChild(s4);
  const demo = {
    id: 'demo', title: 'Series current',
    defaults: { R1: 3, R2: 6, emf: 12 },
    statement: (p) => `<p>A ${p.emf} V battery drives R₁ = ${p.R1} Ω and R₂ = ${p.R2} Ω in series. Find the current.</p>`,
    setup: (ctx, p) => { R1 = p.R1; R2 = p.R2; sR1.set(p.R1, true); sR2.set(p.R2, true); solve(); },
    steps: [
      { text: (p) => `Series resistors add: R<sub>eq</sub> = ${p.R1 + p.R2} Ω.`, act: () => view.set({ highlight: new Set(['R1', 'R2']) }) },
      { text: (p) => `I = ε / R<sub>eq</sub> = ${formatSI(p.emf / (p.R1 + p.R2), 'A')}.`, act: () => view.set({ highlight: new Set(['w1', 'w2', 'w3']) }) },
    ],
    variation: {
      make: (rand) => ({ R1: 1 + Math.round(rand() * 18), R2: 1 + Math.round(rand() * 18), emf: 12 }),
      ask: () => 'What is the current?',
      answer: (ctx, p) => ({ value: solveDC(seriesCircuit(p.emf, p.R1, p.R2)).I.B, unit: 'A' }),
      revisit: 0,
    },
  };
  solveRunner(s4, life, demo, {}, { index: 0 });

  life.frame((dt) => {
    view.frame(dt);
    vA.frame(dt);
    vB.frame(dt);
    runner.frame(dt);
    if (runner.state) rcView.setSolution(runner.state);
    rcView.frame(dt);
    plot.draw();
  });
}

function zeroI(I) {
  const out = {};
  for (const k in I) out[k] = 0;
  return out;
}
