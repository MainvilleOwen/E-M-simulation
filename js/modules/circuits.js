// M1. Circuits: series, parallel, and why.
import { h, infoNote } from '../ui/dom.js';
import { moduleShell, viewBody, ctrlCard, placePredict, dockOnPhone } from '../ui/module-shell.js';
import { CircuitView, bindLayout } from '../ui/circuit-view.js';
import { slider, segmented, readouts, equationReveal, linkSymbols } from '../ui/controls.js';
import { compareLayout } from '../ui/compare.js';
import { predictCard } from '../ui/predict.js';
import { solveRunner } from '../ui/solve-runner.js';
import { StageAnimator } from '../ui/reduce.js';
import { LoopWalker, loopPieces } from '../ui/loop-walk.js';
import { pieceInfo } from '../ui/heightmap.js';
import { solveDC } from '../core/circuit.js';
import { formatSI, formatSigned, formatSame } from '../core/format.js';
import {
  RANGES, oneResistor, seriesCircuit, parallelCircuit, combinationCircuit, bulbCircuit, twoBatteryCircuit,
} from '../content/presets.js';
import {
  oneLayout, seriesLayout, parallelLayout, combinationLayout, bulbLayout, twoBatteryLayout,
  TWO_BATTERY_LOOPS, SERIES_LOOP,
} from '../content/layouts.js';
import { CIRCUIT_PROBLEMS, combinationNumbers, twoBatteryNumbers } from '../content/problems.js';

const EMF = 12;
const f = formatSI;
const R_RANGE = { min: RANGES.R.min, max: RANGES.R.max, step: RANGES.R.step };

/** Shared scales for the plain resistor screens (one dot scale per screen). */
const resistorScales = () => ({ vMin: 0, vMax: EMF, dotK: 7, vmax: 60, pushPerVolt: 1.6, pRef: 30 });

export function mount(root, life, sub) {
  return moduleShell(root, life, {
    route: 'circuits',
    title: 'Circuits: series, parallel, and why',
    question: 'Why does adding a resistor in parallel let <em>more</em> current through?',
    initial: sub ? sub.split('/')[0] : 'one',
    views: [
      { id: 'one', label: 'One resistor', mount: mountOne },
      { id: 'series', label: 'Series', mount: mountSeries },
      { id: 'parallel', label: 'Parallel', mount: mountParallel },
      { id: 'combination', label: 'Combination', mount: mountCombination },
      { id: 'bulbs', label: 'Bulbs', mount: mountBulbs },
      { id: 'kirchhoff', label: 'Walk the loop', mount: mountKirchhoff },
      { id: 'solve', label: 'Solve', mount: mountSolve },
    ],
  });
}

function whyNote() { return h('div', { class: 'why-note', 'aria-live': 'polite' }); }
function setHTML(el, html) { if (el.innerHTML !== html) el.innerHTML = html; }

// ---------------------------------------------------------------------------
// One resistor (baseline)
// ---------------------------------------------------------------------------
function mountOne(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'The battery is a lift: it raises each charge by <strong>ε = 12 V</strong>. The resistor is a ramp back down. All of the height is spent on the one ramp, whatever R is.');
  const scales = resistorScales();
  let R = RANGES.R.value;
  const layout = oneLayout(false);
  const view = new CircuitView(sim, life, { layout, pieces: layout.pieces, scales, dotsNote: true });
  const ro = readouts([
    { key: 'emf', label: 'Battery ε', unit: 'V', sym: 'emf' },
    { key: 'I', label: 'Current <i>I</i>', unit: 'A', sym: 'I' },
    { key: 'V', label: 'Drop across R', unit: 'V', sym: 'V' },
    { key: 'P', label: 'Power in R', unit: 'W', sym: 'P' },
  ]);
  const why = whyNote();
  const sR = slider({ label: 'Resistance <i>R</i>', sym: 'R', ...R_RANGE, value: R, unit: 'Ω', onInput: (v) => { R = v; update(); } });
  const eq = equationReveal(
    '<span class="sym" data-sym="I"><i>I</i></span> = <span class="sym" data-sym="emf">ε</span> / <span class="sym" data-sym="R"><i>R</i></span>',
    { note: 'Tap a symbol to find its slider or readout.' });
  dockOnPhone(ctrlCard(ctrl, 'Change it', sR.el), life);
  ctrlCard(ctrl, 'What the sim measures', ro.el, why, eq.el);
  function update() {
    const circuit = oneResistor(EMF, R);
    bindLayout(layout, circuit);
    const sol = solveDC(circuit);
    view.setSolution(sol);
    if (!sol.ok) return;
    ro.set('emf', EMF); ro.set('I', sol.I.R1); ro.set('V', sol.V.p); ro.set('P', sol.P.R1);
    view.set({ labels: { B: `ε = ${f(EMF, 'V')}`, R1: `R = ${f(R, 'Ω')}` }, hmLabels: { B: 'lift ε', R1: 'ramp R' } });
    setHTML(why, `The ramp always drops the full ${f(EMF, 'V')}. A bigger R lets less current through for that same drop: I = ${f(EMF, 'V')} / ${f(R, 'Ω')} = <strong>${f(sol.I.R1, 'A')}</strong>.`);
  }
  update();
  life.frame((dt) => view.frame(dt));
}

// ---------------------------------------------------------------------------
// Series and parallel share one structure: an optional A-vs-B compare with a prediction first.
// ---------------------------------------------------------------------------
function mountSeries(container, life) {
  mountPair(container, life, {
    kind: 'series',
    intro: 'Two resistors in a row. The <strong>same dots</strong> pass through both, so they carry the same current. The 12 V drop is <strong>shared</strong> between two ramps.',
    compareDefault: false,
    aTitle: 'R<sub>1</sub> alone', bTitle: 'R<sub>1</sub> then R<sub>2</sub> (series)',
    buildA: (p, sw) => oneResistor(EMF, p.R1, sw), layoutA: () => seriesLayout(false, true),
    buildB: (p, sw) => seriesCircuit(EMF, p.R1, p.R2, sw), layoutB: (sw) => seriesLayout(true, sw),
    predict: {
      prompt: 'Circuit B adds R<sub>2</sub> after R<sub>1</sub>. Compared with A, the current through R<sub>1</sub> in B is:',
      options: [{ id: 'more', label: 'Larger' }, { id: 'less', label: 'Smaller' }, { id: 'same', label: 'The same' }],
      correct: 'less',
      explain: (p, sa, sb) => `<p>In B the ${f(EMF, 'V')} drop is shared by two ramps, so R<sub>1</sub> gets a smaller push (shorter arrow: ${f(sb.V.p - sb.V.m, 'V')} instead of ${f(EMF, 'V')}). Less push, less current: ${f(sb.I.R1, 'A')} instead of ${f(sa.I.R1, 'A')}.</p>`,
    },
    readoutsA: [{ key: 'AI', label: 'A: current', unit: 'A' }],
    fillA: (ro, sol) => ro.set('AI', sol.I.R1),
    readoutsB: [
      { key: 'I', label: 'Current <i>I</i>', unit: 'A', sym: 'I' },
      { key: 'Req', label: '<i>R</i><sub>eq</sub> = ε / I', unit: 'Ω', sym: 'Req' },
      { key: 'V1', label: 'Drop across R<sub>1</sub>', unit: 'V', sym: 'V1' },
      { key: 'V2', label: 'Drop across R<sub>2</sub>', unit: 'V', sym: 'V2' },
    ],
    fillB: (ro, sol) => { ro.set('I', sol.I.R1); ro.set('Req', EMF / sol.I.R1); ro.set('V1', sol.V.p - sol.V.m); ro.set('V2', sol.V.m); },
    why: (p, sol) => `Same dots through both: I = ${f(sol.I.R1, 'A')} in R<sub>1</sub> and in R<sub>2</sub>. The drops split in proportion to R: ${f(sol.V.p - sol.V.m, 'V')} + ${f(sol.V.m, 'V')} = ${f(EMF, 'V')}. So R<sub>eq</sub> = R<sub>1</sub> + R<sub>2</sub> = ${f(p.R1 + p.R2, 'Ω')}.`,
    equation: '<span class="sym" data-sym="Req"><i>R</i><sub>eq</sub></span> = <span class="sym" data-sym="R1"><i>R</i><sub>1</sub></span> + <span class="sym" data-sym="R2"><i>R</i><sub>2</sub></span>, &nbsp; <span class="sym" data-sym="I"><i>I</i></span> = ε / <span class="sym" data-sym="Req"><i>R</i><sub>eq</sub></span>',
    hmLabels: { B: 'ε', R1: 'R₁', R2: 'R₂' },
  });
}

function mountParallel(container, life) {
  mountPair(container, life, {
    kind: 'parallel',
    intro: 'Compare <strong>A</strong> (R<sub>1</sub> alone) with <strong>B</strong> (R<sub>1</sub> with R<sub>2</sub> beside it). Both use the same 12 V battery and the same dot and arrow scales.',
    compareDefault: true,
    aTitle: 'R<sub>1</sub> alone', bTitle: 'R<sub>1</sub> ∥ R<sub>2</sub> (parallel)',
    buildA: (p, sw) => oneResistor(EMF, p.R1, sw), layoutA: () => parallelLayout(false, true),
    buildB: (p, sw) => parallelCircuit(EMF, p.R1, p.R2, sw), layoutB: (sw) => parallelLayout(true, sw),
    predict: {
      prompt: 'Circuit B adds R<sub>2</sub> beside R<sub>1</sub>. Compared with A, the current from the battery in B is:',
      options: [{ id: 'more', label: 'Larger' }, { id: 'less', label: 'Smaller' }, { id: 'same', label: 'The same' }],
      correct: 'more',
      explain: (p, sa, sb) => `<p>R<sub>1</sub> in B still sits across the full ${f(EMF, 'V')} drop (same ramp, same push arrow), so it carries the same ${f(sb.I.R1, 'A')} as in A. R<sub>2</sub> adds a second lane with ${f(sb.I.R2, 'A')}. Total: ${f(sb.I.B, 'A')}, more than A’s ${f(sa.I.B, 'A')}.</p>`,
    },
    readoutsA: [{ key: 'AI', label: 'A: battery current', unit: 'A' }],
    fillA: (ro, sol) => ro.set('AI', sol.I.B),
    readoutsB: [
      { key: 'I', label: 'B: battery current', unit: 'A', sym: 'I' },
      { key: 'I1', label: 'B: lane R<sub>1</sub>', unit: 'A', sym: 'I1' },
      { key: 'I2', label: 'B: lane R<sub>2</sub>', unit: 'A', sym: 'I2' },
      { key: 'Req', label: 'B: <i>R</i><sub>eq</sub> = ε / I', unit: 'Ω', sym: 'Req' },
    ],
    fillB: (ro, sol) => { ro.set('I', sol.I.B); ro.set('I1', sol.I.R1); ro.set('I2', sol.I.R2); ro.set('Req', EMF / sol.I.B); },
    why: (p, sol) => `Each lane has the full ${f(EMF, 'V')} drop, so each carries its own current: ${f(sol.I.R1, 'A')} + ${f(sol.I.R2, 'A')} = ${f(sol.I.B, 'A')}. More lanes, more total current, so R<sub>eq</sub> = ${f(EMF / sol.I.B, 'Ω')} is smaller than the smallest resistor.`,
    equation: '1 / <span class="sym" data-sym="Req"><i>R</i><sub>eq</sub></span> = 1 / <span class="sym" data-sym="R1"><i>R</i><sub>1</sub></span> + 1 / <span class="sym" data-sym="R2"><i>R</i><sub>2</sub></span>',
    hmLabels: { B: 'ε', R1: 'R₁ and R₂ (rings)' },
    junction: true,
  });
}

function mountPair(container, life, cfg) {
  linkSymbols(container, life);
  if (cfg.intro) container.appendChild(h('p', { class: 'view-intro', html: cfg.intro }));
  const params = { R1: RANGES.R.value, R2: RANGES.R2.value };
  const modeSeg = segmented({
    label: 'View', value: cfg.compareDefault ? 'compare' : 'single',
    options: [{ value: 'compare', label: 'Compare A and B' }, { value: 'single', label: cfg.kind === 'series' ? 'Series only' : 'Parallel only' }],
    onChange: () => render(),
  });
  container.appendChild(h('div', { class: 'mode-row' }, modeSeg.el));
  const host = h('div');
  container.appendChild(host);
  let inner = null;
  function render() {
    if (inner) inner.destroy();
    host.replaceChildren();
    inner = life.child();
    if (modeSeg.value === 'compare') renderCompare(host, inner, cfg, params);
    else renderSingle(host, inner, cfg, params);
  }
  render();
}

function sliderPair(params, onChange) {
  const s1 = slider({ label: 'R<sub>1</sub>', sym: 'R1', ...R_RANGE, value: params.R1, unit: 'Ω', onInput: (v) => { params.R1 = v; onChange(); } });
  const s2 = slider({ label: 'R<sub>2</sub>', sym: 'R2', ...R_RANGE, value: params.R2, unit: 'Ω', onInput: (v) => { params.R2 = v; onChange(); } });
  return [s1, s2];
}

function resistorLabels(params, withR2 = true) {
  const labels = { B: `${f(EMF, 'V')}`, R1: `R₁ = ${f(params.R1, 'Ω')}` };
  if (withR2) labels.R2 = `R₂ = ${f(params.R2, 'Ω')}`;
  return labels;
}

function renderSingle(host, life, cfg, params) {
  const { sim, ctrl } = viewBody(host);
  const scales = resistorScales();
  const layout = cfg.layoutB(false);
  const view = new CircuitView(sim, life, { layout, pieces: layout.pieces, scales, dotsNote: true });
  const junction = cfg.junction ? junctionBox(sim) : null;
  const ro = readouts(cfg.readoutsB);
  const why = whyNote();
  const eq = equationReveal(cfg.equation);
  dockOnPhone(ctrlCard(ctrl, 'Change it', ...sliderPair(params, update).map((s) => s.el)), life);
  ctrlCard(ctrl, 'What the sim measures', ro.el, why, eq.el);
  let sol = null;
  function update() {
    const circuit = cfg.buildB(params, undefined);
    bindLayout(layout, circuit);
    sol = solveDC(circuit);
    view.setSolution(sol);
    if (!sol.ok) return;
    cfg.fillB(ro, sol);
    view.set({ labels: resistorLabels(params), hmLabels: cfg.hmLabels });
    setHTML(why, cfg.why(params, sol));
    if (junction) junction.reset();
  }
  update();
  life.frame((dt) => {
    view.frame(dt);
    if (junction && sol && sol.ok) junction.tick(dt, sol.I.B, sol.I.R1, sol.I.R2);
  });
}

function renderCompare(host, life, cfg, params) {
  const scales = resistorScales();
  let closed = false;
  const card = predictCard({
    ...cfg.predict,
    explain: () => cfg.predict.explain(params, solA, solB),
    onPick: () => { closed = true; update(); },
    onReset: () => { closed = false; update(); },
  });
  life.add(() => card.destroy());
  const { sim, ctrl } = viewBody(host);
  const cmp = compareLayout(sim, { a: cfg.aTitle, b: cfg.bTitle, note: 'The switches close when you make your prediction. Then watch the dots and the push arrows.' });
  const lA = cfg.layoutA();
  const lB = cfg.layoutB(true);
  const vA = new CircuitView(cmp.a, life, { layout: lA, pieces: lA.pieces, scales, hmMax: 160, minHeight: 150 });
  const vB = new CircuitView(cmp.b, life, { layout: lB, pieces: lB.pieces, scales, hmMax: 160, minHeight: 150, dotsNote: true });
  const junction = cfg.junction ? junctionBox(cmp.b) : null;
  const items = cfg.readoutsA.concat(cfg.readoutsB.map((r) => ({ ...r, label: /^B:/.test(r.label) ? r.label : `B: ${r.label}` })));
  const ro = readouts(items);
  const why = whyNote();
  dockOnPhone(ctrlCard(ctrl, 'Change it (both circuits)', ...sliderPair(params, update).map((s) => s.el)), life);
  ctrlCard(ctrl, 'What the sim measures', ro.el, why, equationReveal(cfg.equation).el);
  placePredict(card.el, sim, ctrl, life);
  let solA = null;
  let solB = null;
  function update() {
    const cA = cfg.buildA(params, closed);
    const cB = cfg.buildB(params, closed);
    bindLayout(lA, cA);
    bindLayout(lB, cB);
    solA = solveDC(cA);
    solB = solveDC(cB);
    vA.setSolution(solA);
    vB.setSolution(solB);
    if (!solA.ok || !solB.ok) return;
    const labA = resistorLabels(params, false);
    const labB = resistorLabels(params, true);
    labA.S = closed ? 'closed' : 'open';
    labB.S = closed ? 'closed' : 'open';
    vA.set({ labels: labA, hmLabels: { B: 'ε', R1: 'R₁' } });
    vB.set({ labels: labB, hmLabels: cfg.hmLabels });
    cfg.fillA(ro, solA);
    cfg.fillB(ro, solB);
    setHTML(why, closed ? cfg.why(params, solB) : 'Make a prediction to close the switches.');
    if (junction) junction.reset();
  }
  update();
  life.frame((dt) => {
    vA.frame(dt);
    vB.frame(dt);
    if (junction && solB && solB.ok) junction.tick(dt, solB.I.B, solB.I.R1, solB.I.R2);
  });
}

/** Junction counters at the split: current and charge in = out. */
function junctionBox(parent) {
  const line1 = h('div');
  const line2 = h('div');
  const el = h('div', { class: 'junction-box', 'aria-live': 'off' },
    h('div', { class: 'junction-title' }, 'At the split (junction)', infoNote('Dots are conserved: every dot that arrives at the junction leaves along one of the lanes. The charge counters add up the current over time since the last change.', { label: 'About the junction counters' })),
    line1, line2);
  parent.appendChild(el);
  let q = [0, 0, 0];
  return {
    el,
    reset() { q = [0, 0, 0]; },
    tick(dt, Iin, I1, I2) {
      q = [q[0] + Iin * dt, q[1] + I1 * dt, q[2] + I2 * dt];
      const [a, b, c] = formatSame([Iin, I1, I2], 'A');
      const [qa, qb, qc] = formatSame(q, 'C');
      const t1 = `Current: in ${a} = out ${b} + ${c}`;
      const t2 = `Charge so far: in ${qa} = out ${qb} + ${qc}`;
      if (line1.textContent !== t1) line1.textContent = t1;
      if (line2.textContent !== t2) line2.textContent = t2;
    },
  };
}

// ---------------------------------------------------------------------------
// Combination: reduce step by step
// ---------------------------------------------------------------------------
const COMBO = { emf: 42, Ra: 8, Rb: 4, Rc: 6, Rd: 3 };

function comboLabels(p) {
  return (stage, sol, pre = '') => {
    const L = {};
    const H = {};
    const put = (id, text, short) => { L[pre + id] = text; H[pre + id] = short; };
    const cur = (id) => (sol && sol.ok ? f(sol.I[id], 'A') : '');
    put('B', f(p.emf, 'V'), 'ε');
    if (stage === 0) {
      put('Ra', `R₁ = ${f(p.Ra, 'Ω')}`, 'R₁'); put('Rb', `R₂ = ${f(p.Rb, 'Ω')}`, 'R₂');
      put('Rc', [`R₃ = ${f(p.Rc, 'Ω')}`, cur('Rc')], 'R₃ ∥ R₄'); put('Rd', [`R₄ = ${f(p.Rd, 'Ω')}`, cur('Rd')], '');
    } else {
      if (stage <= 2) put('Rab', `R₁₂ = ${f(p.Ra + p.Rb, 'Ω')}`, 'R₁₂');
      if (stage === 1) { put('Rc', `R₃ = ${f(p.Rc, 'Ω')}`, 'R₃'); put('Rd', `R₄ = ${f(p.Rd, 'Ω')}`, 'R₄'); }
      if (stage === 2) put('Rcd', `R₃₄ = ${f((p.Rc * p.Rd) / (p.Rc + p.Rd), 'Ω')}`, 'R₃₄');
      if (stage === 3) put('Req', `Req = ${f(p.Ra + p.Rb + (p.Rc * p.Rd) / (p.Rc + p.Rd), 'Ω')}`, 'Req');
    }
    return { labels: L, hmLabels: H };
  };
}

function comboScales(emf) { return { vMin: 0, vMax: emf, dotK: 9, vmax: 60, pushPerVolt: 0.75 * (42 / emf) }; }

function makeComboAnimator(view, p) {
  return new StageAnimator(view, (stage) => ({ circuit: combinationCircuit(p.emf, p, stage), layout: combinationLayout(stage) }), comboLabels(p));
}

function mountCombination(container, life) {
  const { sim, ctrl } = viewBody(container,
    'From the slides: (8 Ω + 4 Ω) in series with (6 Ω ∥ 3 Ω), on a 42 V battery (as in the textbook example). Reduce it one group at a time. Each stage is a real circuit, solved fresh.');
  const p = { ...COMBO };
  const scales = comboScales(p.emf);
  const layout0 = combinationLayout(0);
  const view = new CircuitView(sim, life, { layout: layout0, pieces: layout0.pieces, scales, dotsNote: true });
  const anim = makeComboAnimator(view, p);
  const n = combinationNumbers(p);
  const steps = [
    { stage: 0, text: 'Four resistors. Press <strong>Next step</strong> to reduce the circuit one group at a time. Watch the dots leaving the battery: their speed never changes.' },
    { stage: 1, group: ['Ra', 'Rb'], text: `R<sub>1</sub> and R<sub>2</sub> carry the same current (nothing branches off between them), so they are in series: R<sub>12</sub> = ${p.Ra} Ω + ${p.Rb} Ω = <strong>${f(n.Rab, 'Ω')}</strong>.` },
    { stage: 2, group: ['Rc', 'Rd'], text: `R<sub>3</sub> and R<sub>4</sub> share the same top and bottom heights, so they are in parallel: R<sub>34</sub> = (1/${p.Rc} Ω + 1/${p.Rd} Ω)<sup>−1</sup> = <strong>${f(n.Rcd, 'Ω')}</strong>.` },
    { stage: 3, group: ['Rab', 'Rcd'], text: `R<sub>12</sub> and R<sub>34</sub> are in series: <strong>R<sub>eq</sub> = ${f(n.Rab, 'Ω')} + ${f(n.Rcd, 'Ω')} = ${f(n.Req, 'Ω')}</strong>.` },
    { stage: 3, after: ['wA', 'wB'], text: `Total current: I = ${f(p.emf, 'V')} / ${f(n.Req, 'Ω')} = <strong>${f(n.I, 'A')}</strong>. The same current flowed at every stage.` },
    { stage: 2, after: ['Rcd', 'Rab'], text: `Expand one level: R<sub>34</sub> drops I × R<sub>34</sub> = ${f(n.I, 'A')} × ${f(n.Rcd, 'Ω')} = <strong>${f(n.Vcd, 'V')}</strong>; R<sub>12</sub> drops ${f(n.Vab, 'V')}.` },
    { stage: 0, after: ['Rc', 'Rd'], text: `R<sub>3</sub> and R<sub>4</sub> both feel the same ${f(n.Vcd, 'V')} drop: I<sub>3</sub> = ${f(n.Vcd, 'V')} / ${p.Rc} Ω = <strong>${f(n.Ic, 'A')}</strong>, I<sub>4</sub> = ${f(n.Vcd, 'V')} / ${p.Rd} Ω = <strong>${f(n.Id, 'A')}</strong>. They add to ${f(n.I, 'A')}.` },
  ];
  let k = 0;
  const stepText = h('p', { class: 'reduce-text', 'aria-live': 'polite' });
  const counter = h('span', { class: 'muted small reduce-count' });
  const back = h('button', { type: 'button', class: 'btn reduce-back' }, 'Back');
  const next = h('button', { type: 'button', class: 'btn btn-primary reduce-next' }, 'Next step');
  const reset = h('button', { type: 'button', class: 'btn reduce-reset' }, 'Reset');
  const ro = readouts([
    { key: 'I', label: 'Battery current', unit: 'A' },
    { key: 'Req', label: '<i>R</i><sub>eq</sub> = ε / I', unit: 'Ω' },
  ]);
  dockOnPhone(ctrlCard(ctrl, 'Reduce step by step', h('div', { class: 'btn-row' }, back, next, reset), stepText, counter), life);
  ctrlCard(ctrl, 'What the sim measures', ro.el,
    h('p', { class: 'note' }, 'Pink arrows show each resistor’s push (its voltage drop). Dots drawn as rings travel in the lower branch.'));
  function render() {
    stepText.innerHTML = steps[k].text;
    counter.textContent = `Step ${k} of ${steps.length - 1}`;
    back.disabled = k === 0;
    next.disabled = k === steps.length - 1;
  }
  function go(to) {
    const prev = k;
    k = Math.max(0, Math.min(steps.length - 1, to));
    const st = steps[k];
    if (k > prev) anim.goTo(st.stage, { groupIds: st.group || [], hold: !!st.group, after: st.after || [] });
    else anim.show(st.stage, st.after || []);
    render();
  }
  back.addEventListener('click', () => go(k - 1));
  next.addEventListener('click', () => go(k + 1));
  reset.addEventListener('click', () => { k = 0; anim.show(0); render(); });
  render();
  life.frame((dt) => {
    anim.frame(dt);
    view.frame(dt);
    const sol = anim.cur && anim.cur.sol;
    if (sol && sol.ok) { ro.set('I', sol.I.B); ro.set('Req', p.emf / sol.I.B); }
  });
}

// ---------------------------------------------------------------------------
// Bulbs
// ---------------------------------------------------------------------------
const BULB_R = 6;
const bulbScales = () => ({ vMin: 0, vMax: EMF, dotK: 14, vmax: 60, pushPerVolt: 1.4, pRef: 24 });

function mountBulbs(container, life) {
  container.appendChild(h('p', { class: 'view-intro', html: 'Bulb brightness is proportional to power, P = I<sup>2</sup>R. The bulbs are identical (6 Ω each) on a 12 V battery.' }));
  // Part 1: two bulbs in series
  const part1 = h('section', { class: 'bulb-part', 'aria-label': 'Two bulbs in series' }, h('h2', {}, '1. Two identical bulbs in series'));
  container.appendChild(part1);
  const b1 = viewBody(part1);
  const sc1 = bulbScales();
  let closed1 = false;
  const lay1 = bulbLayout(true, true);
  const v1 = new CircuitView(b1.sim, life, { layout: lay1, pieces: lay1.pieces, scales: sc1, dotsNote: true });
  const ro1 = readouts([
    { key: 'PA', label: 'Power in A', unit: 'W' },
    { key: 'PB', label: 'Power in B', unit: 'W' },
    { key: 'I', label: 'Current', unit: 'A' },
  ]);
  let sol1 = null;
  const card1 = predictCard({
    prompt: 'Close the switch. Compared with bulb A, bulb B (further along the loop) is:',
    options: [{ id: 'brighter', label: 'Brighter' }, { id: 'dimmer', label: 'Dimmer' }, { id: 'same', label: 'Equally bright' }],
    correct: 'same',
    onPick: () => { closed1 = true; up1(); },
    onReset: () => { closed1 = false; up1(); },
    explain: () => `<p>The same dots pass through A and then B, at the same rate: the current is not used up. Same current, same resistance, so the same power: ${f(sol1.P.LA, 'W')} each. What gets used up is height: each bulb spends half of the 12 V.</p>`,
  });
  life.add(() => card1.destroy());
  placePredict(card1.el, b1.sim, b1.ctrl, life);
  ctrlCard(b1.ctrl, 'Numbers', ro1.el);
  function up1() {
    const c = bulbCircuit(EMF, BULB_R, true, closed1);
    bindLayout(lay1, c);
    sol1 = solveDC(c);
    v1.setSolution(sol1);
    if (!sol1.ok) return;
    ro1.set('PA', sol1.P.LA); ro1.set('PB', sol1.P.LB); ro1.set('I', sol1.I.LA);
    v1.set({ labels: { LA: ['A', f(sol1.P.LA, 'W')], LB: ['B', f(sol1.P.LB, 'W')], S: closed1 ? 'closed' : 'open', B: '12 V' }, hmLabels: { LA: 'A', LB: 'B' } });
  }
  up1();

  // Part 2: remove B
  const part2 = h('section', { class: 'bulb-part', 'aria-label': 'Remove bulb B' }, h('h2', {}, '2. Remove B and close the gap with a wire'));
  container.appendChild(part2);
  const b2 = viewBody(part2);
  const sc2 = bulbScales();
  let closed2 = false;
  const cmp = compareLayout(b2.sim, { a: 'Before: A and B in series', b: 'After: B replaced by a wire' });
  const layA = bulbLayout(true, true);
  const layB = bulbLayout(false, true);
  const vA = new CircuitView(cmp.a, life, { layout: layA, pieces: layA.pieces, scales: sc2, hmMax: 150, minHeight: 150 });
  const vB = new CircuitView(cmp.b, life, { layout: layB, pieces: layB.pieces, scales: sc2, hmMax: 150, minHeight: 150 });
  const ro2 = readouts([
    { key: 'Pbefore', label: 'A before', unit: 'W' },
    { key: 'Pafter', label: 'A after', unit: 'W' },
    { key: 'ratio', label: 'Power ratio', format: (v) => (Number.isFinite(v) ? `${v.toFixed(2)}×` : '—') },
    { key: 'Iafter', label: 'Current after', unit: 'A' },
  ]);
  let sA = null;
  let sB = null;
  const card2 = predictCard({
    prompt: 'B is removed and the gap is closed with a wire. Bulb A becomes:',
    options: [{ id: 'brighter', label: 'Brighter' }, { id: 'dimmer', label: 'Dimmer' }, { id: 'same', label: 'The same' }],
    correct: 'brighter',
    onPick: () => { closed2 = true; up2(); },
    onReset: () => { closed2 = false; up2(); },
    explain: () => `<p>The total resistance halved (12 Ω → 6 Ω), so the current doubled: the dots move twice as fast (${f(sA.I.LA, 'A')} → ${f(sB.I.LA, 'A')}). Power goes as I<sup>2</sup>: 2<sup>2</sup> = 4 times as much, ${f(sA.P.LA, 'W')} → ${f(sB.P.LA, 'W')}. A now gets the whole 12 V drop.</p>`,
  });
  life.add(() => card2.destroy());
  placePredict(card2.el, b2.sim, b2.ctrl, life);
  ctrlCard(b2.ctrl, 'Numbers', ro2.el);
  function up2() {
    const cA = bulbCircuit(EMF, BULB_R, true, true);
    const cB = bulbCircuit(EMF, BULB_R, false, closed2);
    bindLayout(layA, cA);
    bindLayout(layB, cB);
    sA = solveDC(cA);
    sB = solveDC(cB);
    vA.setSolution(sA);
    vB.setSolution(sB);
    if (!sA.ok || !sB.ok) return;
    ro2.set('Pbefore', sA.P.LA);
    ro2.set('Pafter', sB.P.LA);
    ro2.set('ratio', closed2 ? sB.P.LA / sA.P.LA : NaN);
    ro2.set('Iafter', sB.I.LA);
    vA.set({ labels: { LA: ['A', f(sA.P.LA, 'W')], LB: ['B', f(sA.P.LB, 'W')], S: 'closed' }, hmLabels: { LA: 'A', LB: 'B' } });
    vB.set({ labels: { LA: ['A', f(sB.P.LA, 'W')], W: 'wire', S: closed2 ? 'closed' : 'open' }, hmLabels: { LA: 'A', W: 'wire' } });
  }
  up2();
  life.frame((dt) => { v1.frame(dt); vA.frame(dt); vB.frame(dt); });
}

// ---------------------------------------------------------------------------
// Walk the loop (Kirchhoff)
// ---------------------------------------------------------------------------
const KB = { E1: 12, R1: 2, R2: 4, E2: 6, R3: 6 };

/** Assumed-current bookkeeping for the two-battery circuit. guessUp: is I₃ guessed to flow up the right branch? */
function kirchhoffAssumptions(guessUp) {
  return {
    R1: { name: 'I₁', dir: 1 },
    R2: { name: 'I₂', dir: 1 },
    R3: { name: 'I₃', dir: guessUp ? -1 : 1 },
  };
}

function assumedArrows(sol, guessUp) {
  const arrows = [
    { at: [31, 18], dir: [1, 0], label: 'I₁', labelOffset: [0, 1] },
    { at: [43, 47], dir: [0, 1], label: 'I₂', labelOffset: [-1, 0] },
    guessUp
      ? { at: [69, 18], dir: [-1, 0], label: 'I₃', labelOffset: [0, 1] }
      : { at: [69, 18], dir: [1, 0], label: 'I₃', labelOffset: [0, 1] },
  ];
  return arrows;
}

function mountKirchhoff(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'Kirchhoff’s loop rule: walk any closed loop and add up every rise and drop in height. You end where you started, so the sum is zero.');
  const state = { circuit: 'two', loop: 'left', guessUp: true };
  const host = h('div', { class: 'sim-col' });
  sim.appendChild(host);
  const circSeg = segmented({
    label: 'Circuit', value: 'two',
    options: [{ value: 'two', label: 'Two batteries' }, { value: 'series', label: 'One loop' }],
    onChange: (v) => { state.circuit = v; build(); },
  });
  const loopSeg = segmented({
    label: 'Loop to walk', value: 'left',
    options: Object.entries(TWO_BATTERY_LOOPS).map(([k, l]) => ({ value: k, label: l.label })),
    onChange: (v) => { state.loop = v; build(); },
  });
  const guessSeg = segmented({
    label: 'Your guess for I<sub>3</sub> (right branch)', value: 'up',
    options: [{ value: 'up', label: 'Up, toward the top node' }, { value: 'down', label: 'Down' }],
    onChange: (v) => { state.guessUp = v === 'up'; build(); },
  });
  const walkBtn = h('button', { type: 'button', class: 'btn btn-primary walk-play' }, 'Walk the loop');
  const stepBtn = h('button', { type: 'button', class: 'btn walk-step' }, 'Next element');
  const resetBtn = h('button', { type: 'button', class: 'btn walk-reset' }, 'Reset');
  const sumNow = h('p', { class: 'walk-sum', 'aria-live': 'polite' });
  const terms = h('ol', { class: 'walk-terms' });
  const kcl = h('div', { class: 'note kcl-note' });
  const ro = readouts([
    { key: 'V', label: 'Top node V', unit: 'V', sym: 'V' },
    { key: 'I1', label: 'I<sub>1</sub> (as guessed)', unit: 'A', sym: 'I1' },
    { key: 'I2', label: 'I<sub>2</sub> (as guessed)', unit: 'A', sym: 'I2' },
    { key: 'I3', label: 'I<sub>3</sub> (as guessed)', unit: 'A', sym: 'I3' },
  ]);
  const optCard = ctrlCard(ctrl, 'Set up', circSeg.el, loopSeg.el, guessSeg.el);
  dockOnPhone(ctrlCard(ctrl, 'Walk', h('div', { class: 'btn-row' }, walkBtn, stepBtn, resetBtn), sumNow, terms), life);
  const kclCard = ctrlCard(ctrl, 'Junction rule at the top node', kcl, ro.el,
    h('p', { class: 'note' }, 'Why Kirchhoff here? No two resistors are simply in series or in parallel (the batteries sit inside the branches), so the reduce-step-by-step method cannot start.'));
  void optCard;

  let inner = null;
  let view = null;
  let walker = null;
  let sol = null;
  let scale = 1;
  let assume = null;
  let shownTerms = -1;
  function build() {
    if (inner) inner.destroy();
    host.replaceChildren();
    inner = life.child();
    const two = state.circuit === 'two';
    loopSeg.el.hidden = !two;
    guessSeg.el.hidden = !two;
    kclCard.hidden = !two;
    const circuit = two ? twoBatteryCircuit(KB) : seriesCircuit(EMF, 3, 6);
    const layout = two ? twoBatteryLayout() : seriesLayout(true, false);
    bindLayout(layout, circuit);
    sol = solveDC(circuit);
    const loop = two ? TWO_BATTERY_LOOPS[state.loop] : SERIES_LOOP;
    walker = new LoopWalker(layout, loop);
    const scales = { vMin: 0, vMax: two ? KB.E1 : EMF, dotK: two ? 12 : 9, vmax: 60, pushPerVolt: 1.6 };
    view = new CircuitView(host, inner, { layout, pieces: loopPieces(layout, loop), scales, dotsNote: true, hmMin: 150 });
    view.setSolution(sol);
    assume = two ? kirchhoffAssumptions(state.guessUp) : { R1: { name: 'I', dir: 1 }, R2: { name: 'I', dir: 1 } };
    const labels = two
      ? { B1: ['ε₁', '12 V'], B2: ['ε₂', '6 V'], R1: ['R₁', '2 Ω'], R2: ['R₂', '4 Ω'], R3: ['R₃', '6 Ω'] }
      : { B: 'ε = 12 V', R1: 'R₁ = 3.00 Ω', R2: 'R₂ = 6.00 Ω' };
    const hmLabels = two ? { B1: 'ε₁', B2: 'ε₂', R1: 'R₁', R2: 'R₂', R3: 'R₃' } : { B: 'ε', R1: 'R₁', R2: 'R₂' };
    view.set({
      labels, hmLabels,
      assumed: two ? assumedArrows(sol, state.guessUp) : [{ at: [40, 4], dir: [1, 0], label: 'I (guess)', labelOffset: [1, 0] }],
      marker: walker.point(),
      hmMarker: (T, W) => markerPos(T, W),
      levels: [{ v: 0, text: '0 V' }, { v: scales.vMax, text: f(scales.vMax, 'V') }],
    });
    shownTerms = -1;
    terms.replaceChildren();
    walkBtn.textContent = 'Walk the loop';
    if (two && sol.ok) {
      const n = twoBatteryNumbers(KB);
      const I3 = assume.R3.dir * sol.I.R3;
      ro.set('V', n.V); ro.set('I1', sol.I.R1); ro.set('I2', sol.I.R2); ro.set('I3', I3);
      const [i1, i2, i3] = formatSame([sol.I.R1, sol.I.R2, I3], 'A');
      const eqn = state.guessUp
        ? `Your guesses: I<sub>1</sub> + I<sub>3</sub> = I<sub>2</sub> → ${i1} + (${i3}) = ${i2}.`
        : `Your guesses: I<sub>1</sub> = I<sub>2</sub> + I<sub>3</sub> → ${i1} = ${i2} + ${i3}.`;
      const sign = I3 < 0
        ? `I<sub>3</sub> came out <strong>negative</strong>: the real current flows the other way (watch the dots), and the size, ${f(Math.abs(I3), 'A')}, is still right.`
        : 'I<sub>3</sub> came out positive: the guess matches the real direction.';
      const [r1, r2, r3] = formatSame([sol.I.R1, sol.I.R2, sol.I.R3], 'A');
      kcl.innerHTML = `<p>Real flow: into the top node ${r1} from the left; out ${r2} down the middle and ${r3} down the right branch, into the 6 V battery’s + terminal (it is being charged).</p><p>${eqn}</p><p>${sign}</p>`;
    }
    updateSum();
  }

  function markerPos(T, W) {
    const pieces = view.mapPieces(T, W);
    const { k, f: fr } = walker.where();
    const p = pieces[k];
    return { x: p.xa + (p.xb - p.xa) * fr, v: walker.potential(sol, scale) };
  }

  function termFor(k) {
    const [id, rev] = walker.loop.steps[k];
    const info = pieceInfo(walker.layout, id);
    const el = walker.layout.elements[id];
    const ref = el.ref;
    const vIn = rev ? sol.V[info.nb] : sol.V[info.na];
    const vOut = rev ? sol.V[info.na] : sol.V[info.nb];
    const dV = vOut - vIn;
    if (info.kind === 'battery') {
      const name = id === 'B2' ? 'ε₂' : id === 'B1' ? 'ε₁' : 'ε';
      return `${rev ? '−' : '+'}${name} = ${formatSigned(dV, 'V')} <span class="muted">(battery, ${rev ? '+ to −' : '− to +'})</span>`;
    }
    const a = assume[id] || { name: 'I', dir: 1 };
    const Iass = a.dir * sol.I[id];
    const along = (rev ? -1 : 1) === a.dir;
    const rName = { R1: 'R₁', R2: 'R₂', R3: 'R₃' }[id] || id;
    const amps = `${Number(Iass.toPrecision(3))} A`.replace('-', '−');
    return `${along ? '−' : '+'}${a.name}${rName} = ${along ? '−' : '+'}(${amps})(${Number(ref.R.toPrecision(3))} Ω) = ${formatSigned(dV, 'V')} <span class="muted">(${along ? 'walking with' : 'walking against'} ${a.name})</span>`;
  }

  function updateSum() {
    if (!walker || !sol || !sol.ok) return;
    const passed = walker.passed();
    if (passed.length !== shownTerms) {
      shownTerms = passed.length;
      terms.replaceChildren(...passed.map((k) => h('li', { html: termFor(k) })));
    }
    const sum = walker.potential(sol, scale) - walker.startPotential(sol);
    const done = walker.done;
    const txt = done
      ? `Back at the start. Sum = ${formatSigned(Math.abs(sum) < 1e-9 ? 0 : sum, 'V')}: the rises and drops cancel.`
      : `Running sum (height above the start): ${formatSigned(Math.abs(sum) < 1e-9 ? 0 : sum, 'V')}`;
    if (sumNow.textContent !== txt) sumNow.textContent = txt;
    view.set({ marker: walker.point() });
  }

  walkBtn.addEventListener('click', () => {
    if (walker.done) walker.reset();
    walker.playing = !walker.playing;
    walkBtn.textContent = walker.playing ? 'Pause' : 'Walk the loop';
  });
  stepBtn.addEventListener('click', () => { walker.playing = false; walkBtn.textContent = 'Walk the loop'; walker.stepToNext(); updateSum(); });
  resetBtn.addEventListener('click', () => { walker.reset(); walkBtn.textContent = 'Walk the loop'; updateSum(); });
  build();
  life.frame((dt) => {
    if (!view) return;
    scale = view.transform().scale;
    walker.frame(dt);
    if (!walker.playing && walkBtn.textContent === 'Pause') walkBtn.textContent = 'Walk the loop';
    updateSum();
    view.frame(dt);
  });
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------
function mountSolve(container, life) {
  container.appendChild(h('p', { class: 'view-intro', html: 'Each problem loads its exact setup in the sim. Step through the solution, then try a variation with new numbers.' }));
  const sel = segmented({
    label: 'Problem', value: 0,
    options: CIRCUIT_PROBLEMS.map((p, i) => ({ value: i, label: `${i + 1}. ${['Combination', 'Two batteries', 'Heater'][i]}` })),
    onChange: (i) => show(i),
  });
  container.appendChild(h('div', { class: 'mode-row' }, sel.el));
  const host = h('div');
  container.appendChild(host);
  let inner = null;
  function show(i) {
    if (inner) inner.destroy();
    host.replaceChildren();
    inner = life.child();
    const { sim, ctrl } = viewBody(host);
    const ctx = makeSolveCtx(sim, inner);
    solveRunner(ctrl, inner, CIRCUIT_PROBLEMS[i], ctx, { index: i });
    inner.frame((dt) => ctx.frame(dt));
  }
  show(0);
}

/** The sim controller that problem steps act on. */
function makeSolveCtx(sim, life) {
  const holder = h('div', { class: 'sim-col' });
  const junction = h('div', { class: 'junction-box', hidden: true });
  sim.append(holder, junction);
  let view = null;
  let anim = null;
  let kind = null;
  let params = null;
  let sol = null;
  let viewLife = null;
  const ctx = {
    load(k, p) {
      kind = k;
      params = { ...p };
      if (viewLife) viewLife.destroy();
      holder.replaceChildren();
      viewLife = life.child();
      junction.hidden = true;
      anim = null;
      if (k === 'combination') {
        const l0 = combinationLayout(0);
        view = new CircuitView(holder, viewLife, { layout: l0, pieces: l0.pieces, scales: comboScales(p.emf), dotsNote: true });
        anim = makeComboAnimator(view, params);
        sol = anim.cur.sol;
      } else if (k === 'kirchhoff') {
        const c = twoBatteryCircuit(p);
        const l = bindLayout(twoBatteryLayout(), c);
        const loop = TWO_BATTERY_LOOPS.left;
        view = new CircuitView(holder, viewLife, { layout: l, pieces: loopPieces(l, loop), scales: { vMin: Math.min(0, p.E2), vMax: Math.max(p.E1, p.E2), dotK: 12, vmax: 60, pushPerVolt: 1.6 }, dotsNote: true });
        sol = solveDC(c);
        view.setSolution(sol);
        view.set({
          labels: { B1: ['ε₁', `${p.E1} V`], B2: ['ε₂', `${p.E2} V`], R1: ['R₁', `${p.R1} Ω`], R2: ['R₂', `${p.R2} Ω`], R3: ['R₃', `${p.R3} Ω`] },
          hmLabels: { B1: 'ε₁', B2: '', R1: 'R₁', R2: 'R₂' },
        });
      } else {
        const c = oneResistor(p.V, p.R);
        const l = bindLayout(oneLayout(false), c);
        view = new CircuitView(holder, viewLife, { layout: l, pieces: l.pieces, scales: { vMin: 0, vMax: p.V, dotK: 2.5, vmax: 60, pushPerVolt: 16 / p.V }, dotsNote: true });
        sol = solveDC(c);
        view.setSolution(sol);
        view.set({ labels: { B: `${p.V} V`, R1: [`R = ${f(p.R, 'Ω')}`, sol.ok ? f(sol.P.R1, 'W') : ''] }, hmLabels: { B: 'ε', R1: 'R' } });
      }
    },
    reduce(stage, ids) { if (anim) anim.goTo(stage, { groupIds: ids, hold: true }); },
    expand(stage, ids) { if (anim) anim.goTo(stage, { groupIds: [], hold: false, after: ids }); },
    highlight(ids) {
      if (anim && anim.busy) return;
      if (view) view.set({ highlight: new Set(ids) });
    },
    showJunction(on) {
      if (kind !== 'kirchhoff' || !sol || !sol.ok) return;
      junction.hidden = !on;
      const [j1, j2, j3] = formatSame([sol.I.R1, sol.I.R2, sol.I.R3], 'A');
      junction.textContent = `Top node: in ${j1} (left) = out ${j2} (middle) + ${j3} (right, downward).`;
      view.set({ highlight: new Set(['wTL', 'wTR']) });
    },
    showAssumed(on) {
      if (kind !== 'kirchhoff' || !view) return;
      view.set({ assumed: on ? assumedArrows(sol, true) : [], highlight: new Set(['R3', 'B2']) });
    },
    frame(dt) {
      if (anim) anim.frame(dt);
      if (view) view.frame(dt);
    },
  };
  return ctx;
}
