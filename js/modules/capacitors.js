// M3. Capacitors: plate lab, series vs parallel, charge sharing.
import { h, infoNote } from '../ui/dom.js';
import { moduleShell, viewBody, ctrlCard, placeResponsive } from '../ui/module-shell.js';
import { CircuitView, bindLayout, potentialLegend } from '../ui/circuit-view.js';
import { slider, segmented, readouts, equationReveal, linkSymbols, timeControls } from '../ui/controls.js';
import { predictCard } from '../ui/predict.js';
import { solveRunner } from '../ui/solve-runner.js';
import { TransientRunner } from '../ui/transient-runner.js';
import { Stage } from '../ui/stage.js';
import { COLORS, colorForV, rgba } from '../ui/colors.js';
import { arrow, label, roundRect } from '../ui/schematic.js';
import { estimateTimeConstants } from '../core/circuit.js';
import { EPS0 } from '../core/fields.js';
import { plateCapacitance, plateForce } from '../core/formulas.js';
import { formatSI } from '../core/format.js';
import { RANGES, capSeriesCircuit, capParallelCircuit, chargeSharingCircuit } from '../content/presets.js';
import { capSeriesLayout, capParallelLayout, chargeSharingLayout } from '../content/layouts.js';
import { CAP_PROBLEMS } from '../content/problems.js';
import { clockLabel } from './rc.js';

const f = formatSI;

export function mount(root, life, sub) {
  return moduleShell(root, life, {
    route: 'capacitors',
    title: 'Capacitors',
    question: 'Why does pulling the plates apart change V in one case and Q in the other?',
    initial: sub ? sub.split('/')[0] : 'plates',
    views: [
      { id: 'plates', label: 'Plate lab', mount: mountPlates },
      { id: 'combos', label: 'Series vs parallel', mount: mountCombos },
      { id: 'sharing', label: 'Charge sharing', mount: mountSharing },
      { id: 'solve', label: 'Solve', mount: mountSolve },
    ],
  });
}

// ---------------------------------------------------------------------------
// Plate lab physics + drawing
// ---------------------------------------------------------------------------

/**
 * Parallel-plate capacitor with a battery that can be connected or disconnected.
 * Connected: V = ε is locked. Disconnected: Q is locked. All values from C = ε0A/d.
 */
export class PlateLab {
  constructor({ A, d, emf, connected = true }) {
    this.A = A;
    this.d = d;
    this.emf = emf;
    this.connected = connected;
    this.Q = plateCapacitance(A, d) * emf;
    this.packets = [];
    this.resetCounters();
    this.setScale();
  }

  get C() { return plateCapacitance(this.A, this.d); }
  get V() { return this.connected ? this.emf : this.Q / this.C; }
  get E() { return this.V / this.d; }
  get sigma() { return this.Q / this.A; }
  get U() { return (this.Q * this.Q) / (2 * this.C); }
  get F() { return plateForce(this.Q, this.A); }

  /** Display scale for charge marks and field lines, set by the battery voltage at the default gap. */
  setScale() { this.Eref = this.emf / 5e-3; }

  resetCounters() {
    this.W = 0;           // work you did
    this.Wbat = 0;        // work done by the battery (V·ΔQ)
    this.U0 = this.U;     // stored energy when the counters were reset
  }

  setConnected(on) {
    if (on === this.connected) return;
    this.connected = on;
    if (on) {
      const Qnew = this.C * this.emf;
      this.spawn(Qnew - this.Q);
      this.Q = Qnew;
    }
    this.resetCounters();
  }

  setEmf(v) {
    this.emf = v;
    this.setScale();
    if (this.connected) {
      const Qnew = this.C * v;
      this.spawn(Qnew - this.Q);
      this.Q = Qnew;
    }
    this.resetCounters();
  }

  /** Move the plates (quasi-statically): W = ∫F dd. */
  setGap(d1) {
    const d0 = this.d;
    if (d1 === d0) return;
    if (this.connected) {
      const V = this.emf;
      this.W += ((EPS0 * this.A * V * V) / 2) * (1 / d0 - 1 / d1);
      this.d = d1;
      const Qnew = this.C * V;
      this.Wbat += V * (Qnew - this.Q);
      this.spawn(Qnew - this.Q);
      this.Q = Qnew;
    } else {
      this.W += this.F * (d1 - d0);
      this.d = d1;
    }
  }

  /** Change the plate area (slide the plates): energy bookkeeping gives your work. */
  setArea(A1) {
    if (A1 === this.A) return;
    const U0 = this.U;
    if (this.connected) {
      this.A = A1;
      const Qnew = this.C * this.emf;
      const dQ = Qnew - this.Q;
      this.Q = Qnew;
      this.Wbat += this.emf * dQ;
      this.W += this.U - U0 - this.emf * dQ;
      this.spawn(dQ);
    } else {
      this.A = A1;
      this.W += this.U - U0;
    }
  }

  get dU() { return this.U - this.U0; }

  spawn(dQ) {
    if (!Number.isFinite(dQ) || dQ === 0) return;
    const qRef = plateCapacitance(2, 5e-3) * this.emf;
    const n = Math.max(1, Math.min(24, Math.round(Math.abs(dQ) / (qRef / 30))));
    for (let i = 0; i < n; i++) this.packets.push({ t: -i * 0.05, dir: Math.sign(dQ) });
    if (this.packets.length > 80) this.packets.splice(0, this.packets.length - 80);
  }

  step(dt) {
    for (const p of this.packets) p.t += dt;
    this.packets = this.packets.filter((p) => p.t < 1);
  }
}

function pathPoint(pts, f) {
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
  let s = f * total;
  for (let i = 0; i < segs.length; i++) {
    if (s <= segs[i] || i === segs.length - 1) {
      const g = segs[i] ? Math.min(1, s / segs[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * g, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * g];
    }
    s -= segs[i];
  }
  return pts[pts.length - 1];
}

/** Draw the plate lab: side view of the plates, σ marks, field lines, battery and charge packets. */
export function drawPlateLab(stage, lab, { highlight = null } = {}) {
  const ctx = stage.begin(COLORS.panel);
  const W = stage.w;
  const H = stage.h;
  const cx = W / 2;
  const cy = H * 0.4;
  const Lp = Math.max(24, Math.min(H * 0.62, (Math.sqrt(lab.A) / 2) * H * 0.62));
  const gap = Math.max(8, (lab.d / 10e-3) * W * 0.5);
  const xl = cx - gap / 2;
  const xr = cx + gap / 2;
  const top = cy - Lp / 2;
  const bot = cy + Lp / 2;
  const V = lab.V;
  const vMax = Math.max(V, 1e-9);
  const cHi = colorForV(V, 0, vMax);
  const cLo = colorForV(0, 0, vMax);
  const yb = H * 0.86;
  const bx = cx;
  ctx.lineCap = 'round';
  // Wires
  const leftPath = [[xl - 6, bot], [xl - 6, yb], [bx - 14, yb]];
  const rightPath = [[bx + 14, yb], [xr + 6, yb], [xr + 6, bot]];
  ctx.lineWidth = 4;
  ctx.strokeStyle = cHi;
  ctx.beginPath(); ctx.moveTo(...leftPath[0]); ctx.lineTo(...leftPath[1]); ctx.lineTo(lab.connected ? bx - 14 : bx - 40, yb); ctx.stroke();
  ctx.strokeStyle = cLo;
  ctx.beginPath(); ctx.moveTo(...rightPath[0]); ctx.lineTo(...rightPath[1]); ctx.lineTo(...rightPath[2]); ctx.stroke();
  if (!lab.connected) {
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 40, yb); ctx.lineTo(bx - 20, yb - 14); ctx.stroke();
    label(ctx, 'disconnected', bx - 30, yb - 30, { size: 13, color: COLORS.muted });
  }
  // Battery (long plate = + on the left)
  ctx.lineCap = 'butt';
  ctx.strokeStyle = lab.connected ? cHi : '#8893a8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(bx - 14, yb - 14); ctx.lineTo(bx - 14, yb + 14); ctx.stroke();
  ctx.strokeStyle = cLo;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(bx + 4, yb - 8); ctx.lineTo(bx + 4, yb + 8); ctx.stroke();
  ctx.lineCap = 'round';
  label(ctx, `battery ε = ${f(lab.emf, 'V')}`, bx, yb + 26, { size: 13, color: COLORS.ink });
  // Field lines (density ∝ E)
  const eRatio = lab.E / lab.Eref;
  const nLines = Math.min(Math.floor(Lp / 7), Math.round((Lp * eRatio) / 20));
  ctx.save();
  for (let i = 0; i < nLines; i++) {
    const y = top + ((i + 0.5) / nLines) * Lp;
    if (gap > 26) arrow(ctx, xl + 6, y, xr - 6, y, { color: COLORS.field, width: 1.5, head: Math.min(8, gap / 4) });
    else { ctx.strokeStyle = COLORS.field; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xl + 5, y); ctx.lineTo(xr - 5, y); ctx.stroke(); }
  }
  ctx.restore();
  // Plates
  if (highlight === 'C') {
    ctx.fillStyle = rgba(COLORS.highlight, 0.25);
    ctx.fillRect(xl - 16, top - 10, gap + 32, Lp + 20);
  }
  ctx.fillStyle = cHi;
  ctx.fillRect(xl - 8, top, 8, Lp);
  ctx.fillStyle = cLo;
  ctx.fillRect(xr, top, 8, Lp);
  // Surface charges (density ∝ σ)
  const sRatio = (lab.sigma / (EPS0 * lab.Eref));
  const maxMarks = Math.floor(Lp / 6);
  const nMarks = Math.min(maxMarks, Math.round((Lp * sRatio) / 14));
  ctx.lineWidth = 2;
  for (let i = 0; i < nMarks; i++) {
    const y = top + ((i + 0.5) / nMarks) * Lp;
    ctx.strokeStyle = COLORS.pos;
    ctx.beginPath(); ctx.moveTo(xl - 18, y); ctx.lineTo(xl - 11, y); ctx.moveTo(xl - 14.5, y - 3.5); ctx.lineTo(xl - 14.5, y + 3.5); ctx.stroke();
    ctx.strokeStyle = COLORS.neg;
    ctx.beginPath(); ctx.moveTo(xr + 11, y); ctx.lineTo(xr + 18, y); ctx.stroke();
  }
  if (highlight === 'Q') {
    ctx.strokeStyle = COLORS.highlight; ctx.lineWidth = 3;
    roundRect(ctx, xl - 24, top - 6, 20, Lp + 12, 6); ctx.stroke();
    roundRect(ctx, xr + 4, top - 6, 20, Lp + 12, 6); ctx.stroke();
  }
  if (highlight === 'E') {
    ctx.strokeStyle = COLORS.highlight; ctx.lineWidth = 3;
    roundRect(ctx, xl + 2, top - 4, gap - 4, Lp + 8, 6); ctx.stroke();
  }
  // Gap dimension
  const yd = bot + 18;
  ctx.strokeStyle = COLORS.muted; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(xl, yd); ctx.lineTo(xr, yd); ctx.moveTo(xl, yd - 5); ctx.lineTo(xl, yd + 5); ctx.moveTo(xr, yd - 5); ctx.lineTo(xr, yd + 5); ctx.stroke();
  label(ctx, `d = ${f(lab.d, 'm')}`, cx, yd + 14, { size: 13, color: COLORS.ink });
  label(ctx, `A = ${f(lab.A, 'm²')} (plates seen edge-on)`, cx, Math.max(12, top - 16), { size: 13, color: COLORS.muted });
  // Charge packets (conventional current)
  for (const p of lab.packets) {
    if (p.t < 0) continue;
    const fr = Math.min(1, p.t);
    // Conventional current: Q falling → + plate to battery (left) and battery − to − plate (right)
    const pos = p.dir > 0 ? 1 - fr : fr;
    const a = pathPoint(leftPath, pos);
    const b = pathPoint(rightPath, pos);
    for (const [x, y] of [a, b]) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#0b0f18'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  return { nMarks, maxMarks, nLines };
}

// ---------------------------------------------------------------------------
// Plate lab view
// ---------------------------------------------------------------------------
function mountPlates(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'Two metal plates facing each other. <strong>Connected</strong> to the battery, V is locked at ε. <strong>Disconnected</strong>, the charge Q has nowhere to go, so Q is locked. Pull the plates apart and watch what changes.');
  const lab = new PlateLab({ A: RANGES.plateA.value, d: RANGES.plateD.value, emf: RANGES.plateV.value, connected: true });
  const panel = h('div', { class: 'circuit-view plate-panel' });
  sim.appendChild(panel);
  const stage = new Stage(panel, life, { aspect: 0.62, minHeight: 260, maxHeight: 420, label: 'Parallel plates with surface charges and field lines' });
  const legend = potentialLegend(0, lab.V);
  panel.appendChild(legend.el);
  panel.appendChild(h('div', { class: 'panel-note' },
    h('span', {}, '+ and − marks: surface charge (density ∝ σ). Arrows: field lines (density ∝ E).'),
    infoNote('Marks and field lines are drawn to a scale set by the battery voltage. Changing A or d keeps that scale, so you can compare honestly. Dots in the wires show charge flowing (conventional current).', { label: 'About the drawing' })));
  const ro = readouts([
    { key: 'C', label: 'Capacitance <i>C</i>', unit: 'F', sym: 'C' },
    { key: 'Q', label: 'Charge <i>Q</i>', unit: 'C', sym: 'Q' },
    { key: 'V', label: 'Voltage <i>V</i>', unit: 'V', sym: 'V' },
    { key: 'E', label: 'Field <i>E</i>', unit: 'V/m', sym: 'E' },
    { key: 'U', label: 'Energy <i>U</i>', unit: 'J', sym: 'U' },
    { key: 'F', label: 'Force between plates', unit: 'N' },
  ]);
  const counters = readouts([
    { key: 'W', label: 'Work you did', unit: 'J' },
    { key: 'dU', label: 'Change in stored energy ΔU', unit: 'J' },
    { key: 'bat', label: 'Energy into the battery', unit: 'J' },
  ], { cls: 'counters' });
  const check = h('p', { class: 'note counter-check' });
  const why = h('div', { class: 'why-note', 'aria-live': 'polite' });
  const modeSeg = segmented({
    label: 'Battery', value: 'on',
    options: [{ value: 'on', label: 'Connected' }, { value: 'off', label: 'Disconnected' }],
    onChange: (v) => { lab.setConnected(v === 'on'); lastMove = null; refresh(); },
  });
  let lastMove = null;
  const sA = slider({ label: 'Plate area <i>A</i>', sym: 'A', ...RANGES.plateA, unit: 'm²', onInput: (v) => { lastMove = v > lab.A ? 'A+' : 'A-'; lab.setArea(v); refresh(); } });
  const sD = slider({ label: 'Gap <i>d</i>', sym: 'd', ...RANGES.plateD, unit: 'm', onInput: (v) => { lastMove = v > lab.d ? 'd+' : 'd-'; lab.setGap(v); refresh(); } });
  const sV = slider({ label: 'Battery ε', sym: 'emf', min: RANGES.plateV.min, max: RANGES.plateV.max, value: RANGES.plateV.value, log: true, unit: 'V', onInput: (v) => { lab.setEmf(v); lastMove = null; refresh(); } });
  const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost reset-counters' }, 'Reset the counters');
  resetBtn.addEventListener('click', () => { lab.resetCounters(); refresh(); });
  const eq = equationReveal('<span class="sym" data-sym="C"><i>C</i></span> = ε<sub>0</sub><span class="sym" data-sym="A"><i>A</i></span> / <span class="sym" data-sym="d"><i>d</i></span>, &nbsp; <span class="sym" data-sym="Q"><i>Q</i></span> = <span class="sym" data-sym="C"><i>C</i></span><span class="sym" data-sym="V"><i>V</i></span>, &nbsp; <span class="sym" data-sym="E"><i>E</i></span> = <span class="sym" data-sym="V"><i>V</i></span> / <span class="sym" data-sym="d"><i>d</i></span>, &nbsp; <span class="sym" data-sym="U"><i>U</i></span> = ½<span class="sym" data-sym="C"><i>C</i></span><span class="sym" data-sym="V"><i>V</i></span><sup>2</sup>');

  // Clicker question: C doubles with Q fixed
  let anim = null;
  const card = predictCard({
    title: 'Clicker question',
    prompt: 'The battery is disconnected. Then the gap is halved, so the capacitance doubles. What happens to the voltage between the plates?',
    options: [{ id: 'double', label: 'It doubles' }, { id: 'half', label: 'It halves' }, { id: 'same', label: 'It stays the same' }],
    correct: 'half',
    delay: 1900,
    onPick: () => {
      modeSeg.set('on');
      lab.setConnected(true);
      lab.setGap(8e-3); sD.set(8e-3, true);
      modeSeg.set('off');
      lab.setConnected(false);
      anim = { from: 8e-3, to: 4e-3, t: 0, V0: lab.V };
      refresh();
    },
    explain: () => `<p>With the battery gone, the charge Q is stuck on the plates. C = ε<sub>0</sub>A/d doubled, so V = Q/C halves: ${f(anim ? anim.V0 : 0, 'V')} → ${f(lab.V, 'V')}. The same charge on the same area gives the same field E, now across half the gap.</p>`,
  });
  life.add(() => card.destroy());

  const changeCard = ctrlCard(ctrl, 'Change it', modeSeg.el, sA.el, sD.el, sV.el, why);
  const measureCard = h('section', { class: 'ctrl-card' }, h('h3', {}, 'What the sim measures'), ro.el, eq.el);
  const energyCard = h('section', { class: 'ctrl-card' }, h('h3', {}, 'Energy bookkeeping'), counters.el, check, resetBtn);
  placeResponsive(measureCard, { wideParent: sim, wideAfter: panel, narrowParent: ctrl, narrowAfter: changeCard }, life);
  placeResponsive(energyCard, { wideParent: sim, wideAfter: measureCard, narrowParent: ctrl, narrowAfter: measureCard }, life);
  placeResponsive(card.el, { wideParent: ctrl, narrowParent: ctrl, narrowAfter: energyCard }, life);

  function refresh() {
    ro.set('C', lab.C); ro.set('Q', lab.Q); ro.set('V', lab.V); ro.set('E', lab.E); ro.set('U', lab.U); ro.set('F', lab.F);
    counters.set('W', lab.W);
    counters.set('dU', lab.dU);
    counters.set('bat', -lab.Wbat);
    legend.set(0, lab.V);
    const conn = lab.connected;
    check.innerHTML = conn
      ? `Battery connected: your work + the battery’s work = ΔU. Here ${f(lab.W, 'J')} + ${f(lab.Wbat, 'J')} = ${f(lab.W + lab.Wbat, 'J')}.`
      : `Battery disconnected: all your work is stored. W = ${f(lab.W, 'J')}, ΔU = ${f(lab.dU, 'J')}.`;
    let text;
    if (conn) {
      text = lastMove === 'd+'
        ? 'V is held at ε. A wider gap means E = V/d drops and C drops, so Q = CV drops: charge flows back into the battery (watch the wires).'
        : lastMove === 'd-'
          ? 'V is held at ε. A narrower gap means a stronger field and a bigger C, so the battery pushes more charge onto the plates.'
          : lastMove === 'A+' ? 'Bigger plates: more room for charge at the same V, so C and Q grow.'
            : lastMove === 'A-' ? 'Smaller plates: less room for charge at the same V, so C and Q shrink, and charge flows back into the battery.'
              : 'Connected: the battery holds V = ε. Try pulling the plates apart (bigger d).';
    } else {
      text = lastMove === 'd+'
        ? 'Q is locked. The charge density σ is unchanged, so E = σ/ε<sub>0</sub> stays the same, and V = Ed grows as the gap widens. You do work pulling against the attraction; it is stored as ΔU.'
        : lastMove === 'd-'
          ? 'Q is locked and E stays the same, so V = Ed shrinks as the gap closes. The plates’ attraction does work on you: W and ΔU are negative.'
          : lastMove ? 'Q is locked. Smaller plates crowd the same charge (bigger σ and E), so V rises; bigger plates spread it out.'
            : 'Disconnected: the charge has nowhere to go, so Q is locked. Try pulling the plates apart.';
    }
    if (why.innerHTML !== text) why.innerHTML = text;
  }
  refresh();
  life.frame((dt) => {
    if (anim && !anim.done) {
      anim.t += dt / 1.4;
      const fr = Math.min(1, anim.t);
      const d = anim.from + (anim.to - anim.from) * fr * fr * (3 - 2 * fr);
      lastMove = 'd-';
      lab.setGap(d);
      sD.set(d, true);
      refresh();
      if (fr >= 1) anim.done = true;
    }
    lab.step(dt);
    if (stage.visible) drawPlateLab(stage, lab);
  });
}

// ---------------------------------------------------------------------------
// Series vs parallel
// ---------------------------------------------------------------------------
const plateScaleFor = (C) => Math.min(1.5, Math.max(0.45, Math.sqrt(C / 6e-6)));

function mountCombos(container, life) {
  linkSymbols(container, life);
  container.appendChild(h('p', { class: 'view-intro', html: 'Two capacitors on one battery. Close the switch and watch where the charge goes. Plate size is drawn ∝ √C.' }));
  const kindSeg = segmented({
    label: 'Arrangement', value: 'series',
    options: [{ value: 'series', label: 'Series' }, { value: 'parallel', label: 'Parallel' }],
    onChange: () => build(),
  });
  container.appendChild(h('div', { class: 'mode-row' }, kindSeg.el));
  const host = h('div');
  container.appendChild(host);
  const s = { C1: RANGES.capC.value, C2: RANGES.capC2.value, emf: RANGES.capEmf.value };
  let inner = null;
  function build() {
    if (inner) inner.destroy();
    host.replaceChildren();
    inner = life.child();
    renderCombo(host, inner, kindSeg.value, s);
  }
  build();
}

function renderCombo(host, life, kind, s) {
  const series = kind === 'series';
  const { sim, ctrl } = viewBody(host);
  const layout = series ? capSeriesLayout() : capParallelLayout();
  const build = (closed) => (series ? capSeriesCircuit(s.emf, s.C1, s.C2, 1, closed) : capParallelCircuit(s.emf, s.C1, s.C2, 1, closed));
  // One dot scale for the screen: the default peak current (18 V through 1 Ω) gives 30 units/s.
  const scales = { vMin: 0, vMax: RANGES.capEmf.max, dotK: 30 / 18, vmax: 80, qPerMark: 12e-6, maxMarks: 14 };
  const view = new CircuitView(sim, life, { layout, pieces: layout.pieces, scales, dotsNote: true, maxHeight: 340, hmMin: 140, hmMax: 190 });
  const tauDefault = estimateTimeConstants(build(true)).tauMin;
  const runner = new TransientRunner({ timeScale: tauDefault / 1.2 });
  const tc = timeControls({
    onPlay: () => play(),
    onPause: () => { runner.playing = false; },
    onReset: () => start(),
    onSpeed: (v) => { runner.speed = v; },
  });
  const runCard = h('section', { class: 'ctrl-card run-card' }, h('h3', {}, 'Close the switch'), tc.el,
    h('p', { class: 'small muted' }, `Clock: ${clockLabel(tauDefault / 1.2)}. Real charging through 1 Ω of wire takes microseconds.`));
  placeResponsive(runCard, { wideParent: ctrl, narrowParent: sim, narrowAfter: view.el }, life);
  const items = [
    { key: 'Ceq', label: '<i>C</i><sub>eq</sub> = Q<sub>battery</sub> / ε', unit: 'F', sym: 'Ceq' },
    { key: 'Q1', label: '<i>Q</i><sub>1</sub>', unit: 'C', sym: 'Q1' },
    { key: 'Q2', label: '<i>Q</i><sub>2</sub>', unit: 'C', sym: 'Q2' },
    { key: 'V1', label: '<i>V</i><sub>1</sub> = Q<sub>1</sub>/C<sub>1</sub>', unit: 'V', sym: 'V1' },
    { key: 'V2', label: '<i>V</i><sub>2</sub> = Q<sub>2</sub>/C<sub>2</sub>', unit: 'V', sym: 'V2' },
  ];
  if (series) items.push({ key: 'island', label: 'Island net charge', unit: 'C' });
  const ro = readouts(items);
  const why = h('div', { class: 'why-note' });
  const sC1 = slider({ label: 'C<sub>1</sub>', sym: 'C1', ...RANGES.capC, unit: 'F', value: s.C1, onInput: (v) => { s.C1 = v; start(); } });
  const sC2 = slider({ label: 'C<sub>2</sub>', sym: 'C2', ...RANGES.capC2, unit: 'F', value: s.C2, onInput: (v) => { s.C2 = v; start(); } });
  const sE = slider({ label: 'Battery ε', sym: 'emf', ...RANGES.capEmf, unit: 'V', value: s.emf, onInput: (v) => { s.emf = v; start(); } });
  const eq = equationReveal(series
    ? '1/<span class="sym" data-sym="Ceq"><i>C</i><sub>eq</sub></span> = 1/<span class="sym" data-sym="C1"><i>C</i><sub>1</sub></span> + 1/<span class="sym" data-sym="C2"><i>C</i><sub>2</sub></span>, &nbsp; <span class="sym" data-sym="Q1"><i>Q</i><sub>1</sub></span> = <span class="sym" data-sym="Q2"><i>Q</i><sub>2</sub></span>'
    : '<span class="sym" data-sym="Ceq"><i>C</i><sub>eq</sub></span> = <span class="sym" data-sym="C1"><i>C</i><sub>1</sub></span> + <span class="sym" data-sym="C2"><i>C</i><sub>2</sub></span>, &nbsp; <span class="sym" data-sym="V1"><i>V</i><sub>1</sub></span> = <span class="sym" data-sym="V2"><i>V</i><sub>2</sub></span> = ε');
  ctrlCard(ctrl, 'Change it', sC1.el, sC2.el, sE.el);
  ctrlCard(ctrl, 'What the sim measures', ro.el, why, eq.el);
  let circuit = null;
  function start() {
    circuit = build(false);
    layout.elements.C1.plateScale = plateScaleFor(s.C1);
    layout.elements.C2.plateScale = plateScaleFor(s.C2);
    bindLayout(layout, circuit);
    runner.load(circuit);
    runner.playing = false;
    tc.setPlaying(false);
    why.innerHTML = 'Press Play to close the switch.';
  }
  function play() {
    const sw = circuit.elements.find((e) => e.id === 'S');
    if (!sw.closed) { sw.closed = true; runner.rebuild(); }
    runner.tEnd = runner.t + 8 * runner.tau;
    runner.playing = true;
    tc.setPlaying(true);
  }
  start();
  const island = layout.island;
  life.frame((dt) => {
    runner.frame(dt);
    if (!runner.playing && tc.playing) tc.setPlaying(false);
    const st = runner.state;
    view.setSolution(runner.ok ? st : null);
    if (st) {
      const q1 = st.q.C1;
      const q2 = st.q.C2;
      const v1 = q1 / s.C1;
      const v2 = q2 / s.C2;
      const qBat = series ? q1 : q1 + q2;
      ro.set('Ceq', qBat / s.emf); ro.set('Q1', q1); ro.set('Q2', q2); ro.set('V1', v1); ro.set('V2', v2);
      if (series) ro.set('island', Math.abs(q2 - q1) < 1e-15 ? 0 : q2 - q1);
      const full = qBat > 0.995 * (series ? (s.C1 * s.C2) / (s.C1 + s.C2) : s.C1 + s.C2) * s.emf;
      if (full) {
        const t = series
          ? `The island in the middle (dashed) started neutral and is cut off from the battery, so it stays neutral: −Q on one inner plate means +Q on the other. Both capacitors hold the same ${f(q1, 'C')}. The voltages split as Q/C: ${f(v1, 'V')} + ${f(v2, 'V')} = ${f(s.emf, 'V')}. The smaller capacitor gets the bigger step.`
          : `Both capacitors are connected to the same two heights, so both have V = ${f(s.emf, 'V')}. The charge splits in proportion to C: ${f(q1, 'C')} and ${f(q2, 'C')}. Side by side, the plate areas combine: C<sub>eq</sub> = C<sub>1</sub> + C<sub>2</sub>.`;
        if (why.innerHTML !== t) why.innerHTML = t;
      } else if (runner.playing && !/Charge is moving/.test(why.textContent)) {
        why.innerHTML = series
          ? 'Charge is moving. Conventional current (dots) flows through the island wire from C<sub>1</sub> to C<sub>2</sub>: electrons are pushed the other way, from C<sub>2</sub>’s inner plate to C<sub>1</sub>’s.'
          : 'Charge is moving onto both capacitors at once.';
      }
      view.set({
        labels: series
          ? { B: f(s.emf, 'V'), S: 'switch', Rw: 'wire 1 Ω', C1: [`C₁ ${f(s.C1, 'F')}`], C2: [`C₂ ${f(s.C2, 'F')}`, `${f(v2, 'V')}`] }
          : { B: f(s.emf, 'V'), S: 'switch', Rw: 'wire 1 Ω', C1: [`C₁ ${f(s.C1, 'F')}`, f(q1, 'C')], C2: [`C₂ ${f(s.C2, 'F')}`, f(q2, 'C')] },
        hmLabels: { B: 'ε', C1: 'C₁', C2: 'C₂' },
        drawSchematicExtra: island ? (ctx, T) => {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = 'rgba(240,228,66,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          island.forEach((pt, i) => { const [x, y] = T.p(pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          const [lx, ly] = T.p([island[1][0] - 1, island[0][1]]);
          label(ctx, 'isolated island', lx, ly - 10, { size: 13, align: 'right', color: '#f0e442' });
        } : null,
      });
    }
    view.frame(runner.playing ? dt : 0);
  });
}

// ---------------------------------------------------------------------------
// Charge sharing
// ---------------------------------------------------------------------------
function energyBars() {
  const row = (cls, text) => {
    const fill = h('span', { class: `pb-fill ${cls}` });
    const val = h('span', { class: 'pb-val' }, '—');
    return { el: h('div', { class: 'pb-row' }, h('span', { class: 'pb-label', html: text }), h('span', { class: 'pb-track' }, fill), val), fill, val };
  };
  const r1 = row('pb-bat', 'Stored in C<sub>1</sub>');
  const r2 = row('pb-cap', 'Stored in C<sub>2</sub>');
  const r3 = row('pb-net', 'Heat in the wire');
  return {
    el: h('div', { class: 'push-bars', role: 'group', 'aria-label': 'Where the energy is' }, r1.el, r2.el, r3.el),
    set(u1, u2, heat, total) {
      for (const [r, v] of [[r1, u1], [r2, u2], [r3, heat]]) {
        r.fill.style.width = `${Math.max(0, Math.min(100, (100 * v) / total))}%`;
        r.val.textContent = f(v, 'J');
      }
    },
  };
}

function mountSharing(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'C<sub>1</sub> starts charged; C<sub>2</sub> starts empty. Close the switch: charge flows through the wire until both tops are at the same height. Then count the energy.');
  const s = { C1: RANGES.shareC1.value, C2: RANGES.shareC2.value, V0: RANGES.shareV.value, Rw: RANGES.shareRw.value };
  const layout = chargeSharingLayout();
  const scales = { vMin: 0, vMax: RANGES.shareV.value, dotK: 0.25, vmax: 80, qPerMark: 80e-6, maxMarks: 14 };
  const view = new CircuitView(sim, life, { layout, pieces: layout.pieces, scales, dotsNote: true, maxHeight: 340, hmMin: 140, hmMax: 200 });
  const tauDefault = estimateTimeConstants(chargeSharingCircuit(s.C1, s.V0, s.C2, s.Rw, true)).tauMin;
  const timeScale = tauDefault / 1.5;
  const runner = new TransientRunner({ timeScale });
  const tc = timeControls({
    onPlay: () => play(),
    onPause: () => { runner.playing = false; },
    onReset: () => start(),
    onSpeed: (v) => { runner.speed = v; },
  });
  const runCard = h('section', { class: 'ctrl-card run-card' }, h('h3', {}, 'Close the switch'), tc.el,
    h('p', { class: 'small muted' }, `Clock: ${clockLabel(timeScale)}. The time scale stays fixed when you change the wire resistance.`));
  placeResponsive(runCard, { wideParent: ctrl, narrowParent: sim, narrowAfter: view.el }, life);
  const bars = energyBars();
  const ro = readouts([
    { key: 'Q', label: 'Total charge (conserved)', unit: 'C', sym: 'Q' },
    { key: 'V1', label: '<i>V</i><sub>1</sub>', unit: 'V', sym: 'V1' },
    { key: 'V2', label: '<i>V</i><sub>2</sub>', unit: 'V', sym: 'V2' },
    { key: 'Ui', label: 'Energy before', unit: 'J', sym: 'Ui' },
    { key: 'U', label: 'Energy stored now', unit: 'J', sym: 'U' },
    { key: 'heat', label: 'Heat in the wire', unit: 'J', sym: 'heat' },
  ]);
  const why = h('div', { class: 'why-note' });
  const sC1 = slider({ label: 'C<sub>1</sub> (charged)', sym: 'C1', ...RANGES.shareC1, unit: 'F', value: s.C1, onInput: (v) => { s.C1 = v; start(); } });
  const sC2 = slider({ label: 'C<sub>2</sub> (empty)', sym: 'C2', ...RANGES.shareC2, unit: 'F', value: s.C2, onInput: (v) => { s.C2 = v; start(); } });
  const sV = slider({ label: 'Starting voltage V<sub>0</sub>', sym: 'V0', ...RANGES.shareV, unit: 'V', value: s.V0, onInput: (v) => { s.V0 = v; start(); } });
  const sR = slider({ label: 'Wire resistance', sym: 'Rw', ...RANGES.shareRw, unit: 'Ω', value: s.Rw, onInput: (v) => { s.Rw = v; start(true); } });
  const eq = equationReveal('<i>V</i> = <span class="sym" data-sym="Q"><i>Q</i></span> / (<span class="sym" data-sym="C1"><i>C</i><sub>1</sub></span> + <span class="sym" data-sym="C2"><i>C</i><sub>2</sub></span>), &nbsp; <span class="sym" data-sym="Ui"><i>U</i><sub>i</sub></span> = ½<span class="sym" data-sym="C1"><i>C</i><sub>1</sub></span><span class="sym" data-sym="V0"><i>V</i><sub>0</sub></span><sup>2</sup>, &nbsp; <span class="sym" data-sym="U"><i>U</i><sub>f</sub></span> = ½(<span class="sym" data-sym="C1"><i>C</i><sub>1</sub></span> + <span class="sym" data-sym="C2"><i>C</i><sub>2</sub></span>)<i>V</i><sup>2</sup>');
  ctrlCard(ctrl, 'Where the energy is', bars.el, why);
  ctrlCard(ctrl, 'Change it', sC1.el, sC2.el, sV.el, sR.el);
  ctrlCard(ctrl, 'What the sim measures', ro.el, eq.el);
  let circuit = null;
  let rwNote = false;
  function start(rwChanged = false) {
    circuit = chargeSharingCircuit(s.C1, s.V0, s.C2, s.Rw, false);
    layout.elements.C1.plateScale = plateScaleFor(s.C1);
    layout.elements.C2.plateScale = plateScaleFor(s.C2);
    bindLayout(layout, circuit);
    runner.load(circuit);
    runner.playing = false;
    tc.setPlaying(false);
    scales.vMax = Math.max(RANGES.shareV.value, s.V0);
    view.refreshLegend();
    rwNote = rwChanged;
    why.innerHTML = rwChanged
      ? 'New wire resistance. Press Play: does the energy lost change?'
      : 'Press Play to close the switch.';
  }
  function play() {
    const sw = circuit.elements.find((e) => e.id === 'S');
    if (!sw.closed) { sw.closed = true; runner.rebuild(); }
    runner.tEnd = runner.t + 10 * runner.tau;
    runner.playing = true;
    tc.setPlaying(true);
  }
  start();
  life.frame((dt) => {
    runner.frame(dt);
    if (!runner.playing && tc.playing) tc.setPlaying(false);
    const st = runner.state;
    view.setSolution(runner.ok ? st : null);
    if (st && runner.sim) {
      const U = runner.sim.storedEnergy();
      const heat = runner.sim.energy.Rw || 0;
      const Ui = 0.5 * s.C1 * s.V0 * s.V0;
      const v1 = st.q.C1 / s.C1;
      const v2 = st.q.C2 / s.C2;
      bars.set(U.C1, U.C2, heat, Ui);
      ro.set('Q', st.q.C1 + st.q.C2); ro.set('V1', v1); ro.set('V2', v2); ro.set('Ui', Ui); ro.set('U', U.C1 + U.C2); ro.set('heat', heat);
      const done = Math.abs(v1 - v2) < 0.002 * s.V0 && circuit.elements.find((e) => e.id === 'S').closed;
      if (done) {
        const t = `The heights are equal at ${f(v1, 'V')}. Charge is conserved (${f(st.q.C1 + st.q.C2, 'C')}), but energy dropped from ${f(Ui, 'J')} to ${f(U.C1 + U.C2, 'J')}. The missing ${f(Ui - U.C1 - U.C2, 'J')} was dissipated in the connecting wire while the charge flowed.${rwNote ? ' A different wire resistance changes how fast it flows, not how much energy is lost.' : ' Try a different wire resistance.'}`;
        if (why.innerHTML !== t) why.innerHTML = t;
      } else if (runner.playing && !/flowing/.test(why.textContent)) {
        why.innerHTML = 'Charge is flowing from the high plate to the low plate. The wire heats up as it goes.';
      }
      view.set({
        labels: { C1: [`C₁ ${f(s.C1, 'F')}`, f(v1, 'V')], C2: [`C₂ ${f(s.C2, 'F')}`, f(v2, 'V')], S: 'switch', Rw: `wire ${f(s.Rw, 'Ω')}` },
        hmLabels: { C1: 'C₁', C2: 'C₂', Rw: 'wire' },
      });
    }
    view.frame(runner.playing ? dt : 0);
  });
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------
function mountSolve(container, life) {
  container.appendChild(h('p', { class: 'view-intro', html: 'Problems from the Ch 25 slides. Each step acts on the sim; then try a variation.' }));
  const sel = segmented({
    label: 'Problem', value: 0,
    options: CAP_PROBLEMS.map((p, i) => ({ value: i, label: `${i + 1}. ${['Parallel plates', 'Series 6 µF + 3 µF', 'Charge sharing'][i]}` })),
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
    const ctx = makeCapSolveCtx(sim, inner);
    solveRunner(ctrl, inner, CAP_PROBLEMS[i], ctx, { index: i });
    inner.frame((dt) => ctx.frame(dt));
  }
  show(0);
}

function makeCapSolveCtx(sim, life) {
  const holder = h('div', { class: 'sim-col' });
  sim.appendChild(holder);
  let viewLife = null;
  let kind = null;
  let p = null;
  let lab = null;
  let stage = null;
  let ro = null;
  let hi = null;
  let view = null;
  let runner = null;
  let circuit = null;
  let islandOn = false;

  function circuitPanel(layout, c, scales, timeScale) {
    view = new CircuitView(holder, viewLife, { layout, pieces: layout.pieces, scales, dotsNote: true, maxHeight: 320, hmMin: 140 });
    circuit = c;
    bindLayout(layout, c);
    runner = new TransientRunner({ timeScale });
    runner.load(c);
    holder.appendChild(h('p', { class: 'small muted' }, `Clock: ${clockLabel(timeScale)}.`));
  }

  return {
    load(k, params) {
      kind = k;
      p = { ...params };
      if (viewLife) viewLife.destroy();
      holder.replaceChildren();
      viewLife = life.child();
      hi = null;
      islandOn = false;
      lab = null; view = null; runner = null;
      if (k === 'plates') {
        const panel = h('div', { class: 'circuit-view plate-panel' });
        holder.appendChild(panel);
        stage = new Stage(panel, viewLife, { aspect: 0.62, minHeight: 240, maxHeight: 380, label: 'Parallel plates' });
        lab = new PlateLab({ A: p.A, d: p.d, emf: p.V, connected: true });
        panel.appendChild(potentialLegend(0, p.V).el);
        ro = readouts([
          { key: 'C', label: 'Capacitance <i>C</i>', unit: 'F' },
          { key: 'Q', label: 'Charge <i>Q</i>', unit: 'C' },
          { key: 'E', label: 'Field <i>E</i>', unit: 'V/m' },
          { key: 'V', label: 'Voltage <i>V</i>', unit: 'V' },
        ]);
        holder.appendChild(h('div', { class: 'ctrl-card' }, ro.el));
        ro.set('C', lab.C); ro.set('Q', lab.Q); ro.set('E', lab.E); ro.set('V', lab.V);
      } else if (k === 'series') {
        const c = capSeriesCircuit(p.emf, p.C1, p.C2, 1, false);
        const layout = capSeriesLayout();
        layout.elements.C1.plateScale = plateScaleFor(p.C1);
        layout.elements.C2.plateScale = plateScaleFor(p.C2);
        const tau = estimateTimeConstants(capSeriesCircuit(p.emf, p.C1, p.C2, 1, true)).tauMin;
        circuitPanel(layout, c, { vMin: 0, vMax: p.emf, dotK: 30 / p.emf, vmax: 80, qPerMark: p.emf * 1e-6, maxMarks: 14 }, tau / 1.2);
      } else {
        const c = chargeSharingCircuit(p.C1, p.V0, p.C2, 1, false);
        const tau = estimateTimeConstants(chargeSharingCircuit(p.C1, p.V0, p.C2, 1, true)).tauMin;
        circuitPanel(chargeSharingLayout(), c, { vMin: 0, vMax: p.V0, dotK: 30 / p.V0, vmax: 80, qPerMark: (p.C1 * p.V0) / 12, maxMarks: 14 }, tau / 1.5);
      }
    },
    highlight(x) {
      if (kind === 'plates') {
        hi = x;
        for (const e of holder.querySelectorAll('.readout')) e.classList.remove('sym-hi');
        const idx = { C: 0, Q: 1, E: 2 }[x];
        const el = holder.querySelectorAll('.readout')[idx];
        if (el) el.classList.add('sym-hi');
      } else if (view) view.set({ highlight: new Set(Array.isArray(x) ? x : [x]) });
    },
    island() { islandOn = true; if (view) view.set({ highlight: new Set(['C1', 'C2', 'wI']) }); },
    charge() { ctxRun(); },
    run() { ctxRun(); },
    frame(dt) {
      if (kind === 'plates' && lab && stage) {
        lab.step(dt);
        if (stage.visible) drawPlateLab(stage, lab, { highlight: hi });
        return;
      }
      if (!view || !runner) return;
      runner.frame(dt);
      const st = runner.state;
      view.setSolution(runner.ok ? st : null);
      if (st) {
        const labels = kind === 'series'
          ? { B: f(p.emf, 'V'), C1: [`C₁ ${f(p.C1, 'F')}`, f(st.q.C1, 'C')], C2: [`C₂ ${f(p.C2, 'F')}`, f(st.q.C2 / p.C2, 'V')], S: 'switch' }
          : { C1: [`C₁ ${f(p.C1, 'F')}`, f(st.q.C1 / p.C1, 'V')], C2: [`C₂ ${f(p.C2, 'F')}`, f(st.q.C2 / p.C2, 'V')], S: 'switch' };
        const island = islandOn && kind === 'series' ? capSeriesLayout().island : null;
        view.set({
          labels,
          hmLabels: { C1: 'C₁', C2: 'C₂' },
          drawSchematicExtra: island ? (ctx, T) => {
            ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(240,228,66,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
            island.forEach((pt, i) => { const [x, y] = T.p(pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            ctx.closePath(); ctx.stroke(); ctx.restore();
          } : null,
        });
      }
      view.frame(runner.playing ? dt : 0);
    },
  };

  function ctxRun() {
    if (!circuit || !runner) return;
    const sw = circuit.elements.find((e) => e.id === 'S');
    if (!sw.closed) { sw.closed = true; runner.rebuild(); }
    runner.tEnd = runner.t + 10 * runner.tau;
    runner.playing = true;
  }
}

