// M2. RC circuits: why a capacitor charges fast at first, then slower and slower.
import { h, infoNote } from '../ui/dom.js';
import { moduleShell, viewBody, ctrlCard, placeResponsive, dockOnPhone } from '../ui/module-shell.js';
import { CircuitView, bindLayout } from '../ui/circuit-view.js';
import { slider, segmented, readouts, equationReveal, linkSymbols, timeControls } from '../ui/controls.js';
import { LivePlot } from '../ui/plot.js';
import { solveRunner } from '../ui/solve-runner.js';
import { TransientRunner } from '../ui/transient-runner.js';
import { COLORS } from '../ui/colors.js';
import { solveDC, estimateTimeConstants } from '../core/circuit.js';
import { formatSI, formatNum } from '../core/format.js';
import { RANGES, rcCircuit, rcExample1, rcExample2 } from '../content/presets.js';
import { rcLayout, rcExample1Layout, rcExample2Layout } from '../content/layouts.js';
import { RC_PROBLEMS, rcEx1Numbers, rcEx2Numbers } from '../content/problems.js';

const f = formatSI;
const EMF = RANGES.rcEmf.value;
/** Default τ = 20 kΩ × 150 µF = 3.00 s, so the RC lab runs in real time at 1×. */
const LAB_TIME_SCALE = 1;

export function mount(root, life, sub) {
  return moduleShell(root, life, {
    route: 'rc',
    title: 'RC circuits',
    question: 'Why does a capacitor charge fast at first, then slower and slower?',
    initial: sub ? sub.split('/')[0] : 'charging',
    views: [
      { id: 'charging', label: 'Charging', mount: (c, l) => mountLab(c, l, 'charge') },
      { id: 'discharging', label: 'Discharging', mount: (c, l) => mountLab(c, l, 'discharge') },
      { id: 'solve', label: 'Solve', mount: mountSolve },
    ],
  });
}

/** "Real time" / "slow motion" label for a time scale (sim seconds per real second). */
export function clockLabel(scale) {
  if (Math.abs(scale - 1) < 1e-9) return 'real time';
  if (scale < 1) return `slow motion: 1 s on screen = ${f(scale, 's')} of real time`;
  return `sped up: 1 s on screen = ${f(scale, 's')} of real time`;
}

/** The push tug-of-war: battery push, capacitor push-back, net push (DOM bars). */
function pushBars(mode) {
  const row = (cls, label) => {
    const fill = h('span', { class: `pb-fill ${cls}` });
    const val = h('span', { class: 'pb-val' }, '—');
    const el = h('div', { class: 'pb-row' }, h('span', { class: 'pb-label', html: label }), h('span', { class: 'pb-track' }, fill), val);
    return { el, fill, val };
  };
  const bat = row('pb-bat', 'Battery push ε');
  const cap = row('pb-cap', mode === 'charge' ? 'Capacitor push-back q/C' : 'Capacitor push q/C');
  const net = row('pb-net', mode === 'charge' ? 'Net push ε − q/C' : 'Net push = q/C');
  const el = h('div', { class: 'push-bars', role: 'group', 'aria-label': 'Push on the charges' },
    mode === 'charge' ? bat.el : null, cap.el, net.el,
    h('p', { class: 'small muted pb-note' }, 'The net push is the drop across R, so it sets the current: I = (net push) / R.'));
  return {
    el,
    /** bat: battery push in the loop (0 if the switch is open); vc: q/C; n: drop across R (from the solver). */
    set(batV, vc, n, vmax) {
      const pct = (v) => `${Math.max(0, Math.min(100, (100 * v) / vmax))}%`;
      bat.fill.style.width = pct(batV); bat.val.textContent = f(batV, 'V');
      cap.fill.style.width = pct(vc); cap.val.textContent = f(vc, 'V');
      net.fill.style.width = pct(n); net.val.textContent = f(n, 'V');
    },
  };
}

// ---------------------------------------------------------------------------
// Charging / discharging lab
// ---------------------------------------------------------------------------
function mountLab(container, life, mode) {
  linkSymbols(container, life);
  const charge = mode === 'charge';
  const { sim, ctrl } = viewBody(container, charge
    ? 'Press <strong>Play</strong> to close the switch. Charge piles up on the plates, the capacitor’s step on the height map rises, and it pushes back against the battery. The net push shrinks, so the dots slow down.'
    : 'The capacitor starts full. Press <strong>Play</strong> to flip the switch: the battery leaves the loop and the capacitor pushes charge back around through R. As it empties, its push shrinks, so the dots slow down.');
  const s = { R: RANGES.rcR.value, C: RANGES.rcC.value };
  const scales = { vMin: 0, vMax: EMF, dotK: 40000, vmax: 80, pushPerVolt: 1.6, qPerMark: 0.06e-3, maxMarks: 16 };
  const layout = rcLayout();
  // Discharging: the battery is out of the loop, so the height map follows only the capacitor loop.
  const pieces = charge ? layout.pieces : layout.pieces.filter((p) => !['B', 'wP', 'Sc', 'wG2'].includes(p.id))
    .concat([{ id: 'wXd' }, { id: 'Sd' }, { id: 'wGd' }]);
  const view = new CircuitView(sim, life, { layout, pieces, scales, dotsNote: true, maxHeight: 250, hmMin: 140, hmMax: 170 });
  const plotWrap = h('div', { class: 'plots three' });
  sim.appendChild(plotWrap);
  const pq = new LivePlot(plotWrap, life, { title: 'Charge <i>q</i>(<i>t</i>)', unit: 'C', color: COLORS.trace, sym: 'q' });
  const pI = new LivePlot(plotWrap, life, { title: 'Current <i>I</i>(<i>t</i>)', unit: 'A', color: COLORS.trace2, sym: 'I' });
  const pV = new LivePlot(plotWrap, life, { title: 'Capacitor voltage <i>V</i><sub>C</sub>(<i>t</i>)', unit: 'V', color: COLORS.trace3, sym: 'Vc' });
  const plots = [pq, pI, pV];
  sim.appendChild(h('p', { class: 'panel-note-light small' }, 'Graphs are traced live from the simulation. The dashed line is the previous run, so you can compare.'));

  const runner = new TransientRunner({ timeScale: LAB_TIME_SCALE, onSample: (st) => sample(st) });
  const tc = timeControls({
    onPlay: () => play(),
    onPause: () => { runner.playing = false; },
    onReset: () => start({ keepGhost: false }),
    onSpeed: (v) => { runner.speed = v; updateClock(); },
  });
  const bars = pushBars(mode);
  const ro = readouts([
    { key: 'tau', label: 'τ = RC', unit: 's', sym: 'tau' },
    { key: 'q', label: 'Charge <i>q</i>', unit: 'C', sym: 'q' },
    { key: 'I', label: 'Current <i>I</i>', unit: 'A', sym: 'I' },
    { key: 'Vc', label: '<i>V</i><sub>C</sub> = q/C', unit: 'V', sym: 'Vc' },
    { key: 'frac', label: charge ? 'q as % of Cε' : 'q as % of start', format: (v) => (Number.isFinite(v) ? `${formatNum(v, 3)}%` : '—') },
    charge ? { key: 'emf', label: 'Battery ε', unit: 'V', sym: 'emf' } : null,
    charge ? { key: 'Ebat', label: 'Energy from the battery', unit: 'J' } : null,
    { key: 'Ustore', label: 'Energy stored in C', unit: 'J' },
    { key: 'heat', label: 'Heat in R', unit: 'J' },
  ].filter(Boolean));
  const why = h('div', { class: 'why-note', 'aria-live': 'polite' });
  const sR = slider({ label: 'Resistance <i>R</i>', sym: 'R', min: RANGES.rcR.min, max: RANGES.rcR.max, step: RANGES.rcR.step, value: s.R, unit: 'Ω', onInput: (v) => { const old = s.R; s.R = v; explainChange('R', old, v); start({ keepGhost: true, autoplay: true }); } });
  const sC = slider({ label: 'Capacitance <i>C</i>', sym: 'C', min: RANGES.rcC.min, max: RANGES.rcC.max, step: RANGES.rcC.step, value: s.C, unit: 'F', onInput: (v) => { const old = s.C; s.C = v; explainChange('C', old, v); start({ keepGhost: true, autoplay: true }); } });
  const eq = equationReveal(charge
    ? '<span class="sym" data-sym="q"><i>q</i></span>(<i>t</i>) = <span class="sym" data-sym="C"><i>C</i></span><span class="sym" data-sym="emf">ε</span>(1 − e<sup>−<i>t</i>/<span class="sym" data-sym="tau">τ</span></sup>), &nbsp; <span class="sym" data-sym="I"><i>I</i></span>(<i>t</i>) = (<span class="sym" data-sym="emf">ε</span>/<span class="sym" data-sym="R"><i>R</i></span>) e<sup>−<i>t</i>/<span class="sym" data-sym="tau">τ</span></sup>, &nbsp; <span class="sym" data-sym="tau">τ</span> = <span class="sym" data-sym="R"><i>R</i></span><span class="sym" data-sym="C"><i>C</i></span>'
    : '<span class="sym" data-sym="q"><i>q</i></span>(<i>t</i>) = <i>Q</i> e<sup>−<i>t</i>/<span class="sym" data-sym="tau">τ</span></sup>, &nbsp; <span class="sym" data-sym="I"><i>I</i></span>(<i>t</i>) = (<i>Q</i>/<span class="sym" data-sym="R"><i>R</i></span><span class="sym" data-sym="C"><i>C</i></span>) e<sup>−<i>t</i>/<span class="sym" data-sym="tau">τ</span></sup>, &nbsp; <span class="sym" data-sym="tau">τ</span> = <span class="sym" data-sym="R"><i>R</i></span><span class="sym" data-sym="C"><i>C</i></span>',
    { note: charge ? 'At t = τ: q = 63% of Cε and I = 37% of ε/R.' : 'At t = τ: q and I are both 37% of their starting values.' });
  const runCard = h('section', { class: 'ctrl-card run-card' }, h('h3', {}, 'Run it'), tc.el);
  placeResponsive(runCard, { wideParent: ctrl, narrowParent: sim, narrowAfter: view.el }, life);
  ctrlCard(ctrl, 'The push on the charges', bars.el);
  dockOnPhone(ctrlCard(ctrl, 'Change it (replays the run)', sR.el, sC.el, why), life);
  ctrlCard(ctrl, 'What the sim measures', ro.el, eq.el,
    h('div', { class: 'info-line' }, h('span', { class: 'small muted' }, 'About time'), infoNote(`At 1× the clock runs in ${clockLabel(LAB_TIME_SCALE)}. The default τ is 3.00 s. The time scale stays fixed when you change R or C, so a slower run really is slower.`)));

  let circuit = null;
  let tau = s.R * s.C;
  let ghostTau = null;
  let lastSample = -1;

  function start({ keepGhost = false, autoplay = false } = {}) {
    const prevTau = tau;
    tau = estimateTimeConstants(rcCircuit(EMF, s.R, s.C, mode)).tauMin;
    ghostTau = keepGhost ? prevTau : null;
    circuit = rcCircuit(EMF, s.R, s.C, 'off', charge ? 0 : s.C * EMF);
    bindLayout(layout, circuit);
    runner.load(circuit);
    runner.playing = false;
    const tMax = 5 * Math.max(tau, ghostTau || 0);
    runner.tEnd = tMax;
    const q0 = s.C * EMF;
    for (const p of plots) p.reset({ keepGhost });
    const ghostQ = keepGhost && pq.ghost ? Math.max(...pq.ghost.map((d) => d[1])) : 0;
    const ghostI = keepGhost && pI.ghost ? Math.max(...pI.ghost.map((d) => d[1])) : 0;
    pq.setAxes({ tMax, yMax: Math.max(q0, ghostQ) * 1.08 });
    pI.setAxes({ tMax, yMax: Math.max(EMF / s.R, ghostI) * 1.08 });
    pV.setAxes({ tMax, yMax: EMF * 1.08 });
    const I0 = EMF / s.R;
    pq.setMarkers([{ type: 'v', at: tau, label: 'τ' }, { type: 'h', at: charge ? 0.632 * q0 : 0.368 * q0, label: charge ? '63% of Cε' : '37%' }]);
    pI.setMarkers([{ type: 'v', at: tau, label: 'τ' }, { type: 'h', at: 0.368 * I0, label: '37%' }]);
    pV.setMarkers([{ type: 'v', at: tau, label: 'τ' }, { type: 'h', at: charge ? 0.632 * EMF : 0.368 * EMF, label: charge ? '63%' : '37%' }]);
    lastSample = -1;
    tc.setPlaying(false);
    sample(runner.state, true);
    if (!keepGhost) setWhy(charge ? 'Press Play to close the switch.' : 'Press Play to flip the switch and let the capacitor push.');
    if (autoplay) { tc.setPlaying(true); play(); }
    updateReadouts();
  }

  function play() {
    if (!runner.sim) return;
    if (runner.t >= runner.tEnd - 1e-9) start({ keepGhost: false });
    if (circuit.elements.find((e) => e.id === 'Sc').closed === false && circuit.elements.find((e) => e.id === 'Sd').closed === false) {
      circuit.elements.find((e) => e.id === (charge ? 'Sc' : 'Sd')).closed = true;
      runner.rebuild();
      sample(runner.state, true);
    }
    runner.playing = true;
    tc.setPlaying(true);
    if (/Press Play/.test(why.textContent)) {
      setWhy(charge
        ? 'As charge piles up, the capacitor’s push-back q/C grows (blue). The net push ε − q/C (pink) shrinks, so the current falls. That is why charging slows down.'
        : 'The capacitor is the only push now. As it empties, q/C shrinks, so the current falls. That is why discharging slows down.');
    }
  }

  function sample(st, force = false) {
    if (!st) return;
    if (!force && st.t - lastSample < 1e-12) return;
    lastSample = st.t;
    const q = st.q.C;
    pq.push(st.t, q);
    pI.push(st.t, Math.abs(st.I.R));
    pV.push(st.t, q / s.C);
  }

  function setWhy(html) { if (why.innerHTML !== html) why.innerHTML = html; }

  function explainChange(which, oldV, newV) {
    if (newV === oldV) return;
    const bigger = newV > oldV;
    if (which === 'R') {
      setWhy(bigger
        ? '<strong>Bigger R:</strong> the same push drives less current, so the flow is slower. The final charge is the same (Cε): the capacitor still fills until its push-back equals ε.'
        : '<strong>Smaller R:</strong> the same push drives more current, so it fills faster. The final charge is the same (Cε).');
    } else if (charge) {
      setWhy(bigger
        ? '<strong>Bigger C:</strong> more charge must pile up before the push-back q/C gets strong, so charging is slower and the final charge Cε is larger.'
        : '<strong>Smaller C:</strong> a little charge already makes a strong push-back, so it fills sooner and the final charge is smaller.');
    } else {
      setWhy(bigger
        ? '<strong>Bigger C:</strong> it starts with more charge (Cε) and each coulomb gives less push (q/C), so it takes longer to empty.'
        : '<strong>Smaller C:</strong> less charge to move, and each coulomb pushes harder, so it empties sooner.');
    }
  }

  function updateClock() {
    const t = runner.t;
    tc.setClock(`t = ${f(t, 's')} (${formatNum(t / tau, 2)} τ) · ${clockLabel(runner.timeScale * runner.speed)}`);
  }

  function updateReadouts() {
    const st = runner.state;
    if (!st) return;
    const q = st.q.C;
    const vc = q / s.C;
    ro.set('tau', tau); ro.set('q', q); ro.set('I', Math.abs(st.I.R)); ro.set('Vc', vc); ro.set('emf', EMF);
    ro.set('frac', (100 * q) / (s.C * EMF));
    const sim = runner.sim;
    if (sim) {
      ro.set('Ebat', -(sim.energy.B || 0));
      ro.set('Ustore', 0.5 * s.C * vc * vc);
      ro.set('heat', sim.energy.R || 0);
    }
    const batIn = charge && circuit && circuit.elements.find((e) => e.id === 'Sc').closed;
    bars.set(batIn ? EMF : 0, vc, Math.abs(st.V.x - st.V.y), EMF);
    updateClock();
  }

  const xR = (layout.elements.R.a[0] + layout.elements.R.b[0]) / 2;
  const xC = layout.elements.C.a[0];
  start({ keepGhost: false });
  life.frame((dt) => {
    runner.frame(dt);
    if (!runner.playing && tc.playing) tc.setPlaying(false);
    const st = runner.state;
    if (!runner.ok) view.setSolution(null);
    else view.setSolution(st);
    if (st) {
      const vx = st.V.x;
      const vy = st.V.y;
      const vc = st.q.C / s.C;
      view.set({
        labels: {
          B: charge ? f(EMF, 'V') : ['battery', '(not in the loop)'], R: `R = ${f(s.R, 'Ω')}`, C: [`C = ${f(s.C, 'F')}`, `q = ${f(st.q.C, 'C')}`],
          Sc: charge ? 'charge switch' : 'charge switch (open)', Sd: charge ? ['discharge', 'switch', '(open)'] : ['discharge', 'switch'],
        },
        alpha: charge ? null : { B: 0.35, wP: 0.35, Sc: 0.5 },
        hmLabels: charge ? { B: 'lift ε', R: 'ramp R', C: 'step q/C' } : { R: 'ramp R (charge slides down it, leftward)', C: 'lift q/C' },
        annotations: (T) => [
          { x: T.x(xR), v0: vx, v1: vy, label: charge ? `net push ε − q/C = ${f(vx - vy, 'V')}` : `net push q/C = ${f(vy - vx, 'V')}`, align: 'right', labelDx: -(T.x(layout.elements.R.b[0]) - T.x(layout.elements.R.a[0])) * 0.25 - 6 },
          { x: T.x(xC) - 18, v0: 0, v1: vc, color: COLORS.neg, label: `q/C = ${f(vc, 'V')}`, align: 'right', labelDx: -8 },
        ],
      });
      updateReadouts();
    }
    view.frame(runner.playing ? dt : 0);
    for (const p of plots) p.draw();
  });
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------
function mountSolve(container, life) {
  container.appendChild(h('p', { class: 'view-intro', html: 'Both RC examples from the Ch 27 slides. Each step acts on the sim. The clock runs in slow motion so you can watch τ.' }));
  const sel = segmented({
    label: 'Problem', value: 0,
    options: RC_PROBLEMS.map((p, i) => ({ value: i, label: `${i + 1}. ${['Switch across the middle', 'Open the switch'][i]}` })),
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
    const ctx = makeRcSolveCtx(sim, inner);
    solveRunner(ctrl, inner, RC_PROBLEMS[i], ctx, { index: i });
    inner.frame((dt) => ctx.frame(dt));
  }
  show(0);
}

function makeRcSolveCtx(sim, life) {
  const holder = h('div', { class: 'sim-col' });
  sim.appendChild(holder);
  let kind = null;
  let p = null;
  let view = null;
  let runner = null;
  let circuit = null;
  let plots = null;
  let tc = null;
  let viewLife = null;
  let currentId = 'S';
  let xNote = null;

  function setPlots(tMax, qMax, iMax, markersQ, markersI) {
    plots.q.reset({ keepGhost: false });
    plots.i.reset({ keepGhost: false });
    plots.q.setAxes({ tMax, yMax: qMax * 1.1 });
    plots.i.setAxes({ tMax, yMax: iMax * 1.1 });
    plots.q.setMarkers(markersQ || []);
    plots.i.setMarkers(markersI || []);
    if (runner.state) { plots.q.push(runner.t - runner.t0, runner.state.q.C); plots.i.push(runner.t - runner.t0, Math.abs(runner.state.I[currentId])); }
  }

  function loadCircuit(c, { play = false, tEnd = Infinity } = {}) {
    circuit = c;
    bindLayout(view.layout, c);
    runner.load(c);
    runner.t0 = 0;
    runner.tEnd = tEnd;
    runner.playing = play;
    tc.setPlaying(play);
  }

  function rebuildRun(tSpan) {
    runner.rebuild();
    runner.t0 = runner.t;
    runner.tEnd = runner.t + tSpan;
    runner.playing = true;
    tc.setPlaying(true);
  }

  const ctx = {
    load(k, params) {
      kind = k;
      p = { ...params };
      if (viewLife) viewLife.destroy();
      holder.replaceChildren();
      viewLife = life.child();
      const layout = k === 'ex1' ? rcExample1Layout() : rcExample2Layout();
      const qMaxGuess = k === 'ex1' ? p.C * p.emf : p.C * p.emf;
      const I0 = k === 'ex1' ? p.emf / p.R1 + p.emf / p.R2 : p.emf / (p.R2 + p.R3);
      const scales = { vMin: 0, vMax: p.emf, dotK: 25 / I0, vmax: 80, pushPerVolt: 16 / p.emf, qPerMark: qMaxGuess / 30, maxMarks: 12 };
      view = new CircuitView(holder, viewLife, { layout, pieces: layout.pieces, scales, dotsNote: true, hmMin: 140 });
      const tauRef = k === 'ex1' ? rcEx1Numbers(p).tauBefore : rcEx2Numbers(p).tau;
      const timeScale = tauRef / 3; // τ shows as about 3 s on screen
      runner = new TransientRunner({ timeScale, onSample: (st) => { plots.q.push(st.t - runner.t0, st.q.C); plots.i.push(st.t - runner.t0, Math.abs(st.I[currentId])); } });
      runner.t0 = 0;
      tc = timeControls({
        onPlay: () => { runner.playing = true; },
        onPause: () => { runner.playing = false; },
        onReset: () => ctx.load(kind, p),
        onSpeed: (v) => { runner.speed = v; },
      });
      holder.appendChild(h('div', { class: 'ctrl-card solve-time' }, tc.el));
      const pw = h('div', { class: 'plots' });
      holder.appendChild(pw);
      currentId = k === 'ex1' ? 'S' : 'R2';
      plots = {
        q: new LivePlot(pw, viewLife, { title: 'Charge on C, <i>q</i>(<i>t</i>)', unit: 'C', color: COLORS.trace }),
        i: new LivePlot(pw, viewLife, { title: k === 'ex1' ? 'Current in the switch, <i>I</i><sub>S</sub>(<i>t</i>)' : 'Current in R<sub>2</sub>, <i>I</i><sub>R2</sub>(<i>t</i>)', unit: 'A', color: COLORS.trace2 }),
      };
      xNote = h('p', { class: 'small muted' }, `Clock: ${clockLabel(timeScale)}.`);
      holder.appendChild(xNote);
      if (k === 'ex1') {
        loadCircuit(rcExample1(p, false, 0));
      } else {
        loadCircuit(rcExample2(p, false, 0));
      }
      setPlots(3 * tauRef, qMaxGuess, I0, [], []);
    },
    chargeOpen() {
      const n = rcEx1Numbers(p);
      loadCircuit(rcExample1(p, false, 0), { play: true, tEnd: 5 * n.tauBefore });
      setPlots(5 * n.tauBefore, n.Q, p.emf / p.R1, [{ type: 'v', at: n.tauBefore, label: 'τ' }, { type: 'h', at: 0.632 * n.Q, label: '63%' }], [{ type: 'v', at: n.tauBefore, label: 'τ' }]);
      view.set({ highlight: new Set(['B', 'R1', 'R2', 'C']) });
    },
    full() {
      const n = rcEx1Numbers(p);
      loadCircuit(rcExample1(p, false, n.Q));
      setPlots(5 * n.tauAfter, n.Q, n.Is0, [], []);
      view.set({ highlight: new Set(['C']) });
    },
    closeSwitch(ids) {
      const n = rcEx1Numbers(p);
      if (!circuit || circuit.elements.find((e) => e.id === 'S').closed || runner.state.q.C < 0.99 * n.Q) ctx.full();
      circuit.elements.find((e) => e.id === 'S').closed = true;
      rebuildRun(5 * n.tauAfter);
      setPlots(5 * n.tauAfter, n.Q, n.Is0, [{ type: 'v', at: n.tauAfter, label: 'τ' }], [{ type: 'v', at: n.tauAfter, label: 'τ' }, { type: 'h', at: n.Ileft, label: 'ε/R₁' }]);
      view.set({ highlight: new Set(ids) });
    },
    toSteady(ids) {
      const n = rcEx2Numbers(p);
      loadCircuit(rcExample2(p, true, n.Q), { play: true, tEnd: 5 * n.tau });
      setPlots(5 * n.tau, n.Q, n.IR2_0, [], []);
      view.set({ highlight: new Set(ids) });
    },
    openSwitch(ids) {
      const n = rcEx2Numbers(p);
      if (!circuit || !circuit.elements.find((e) => e.id === 'S').closed) ctx.toSteady([]);
      circuit.elements.find((e) => e.id === 'S').closed = false;
      rebuildRun(5 * n.tau);
      setPlots(5 * n.tau, n.Q, n.IR2_0, [{ type: 'v', at: n.tau, label: 'τ' }, { type: 'h', at: 0.368 * n.Q, label: '37%' }], [{ type: 'v', at: n.tau, label: 'τ' }, { type: 'h', at: 0.368 * n.IR2_0, label: '37%' }]);
      view.set({ highlight: new Set(ids) });
    },
    markFifth() {
      const n = rcEx2Numbers(p);
      plots.q.setMarkers([{ type: 'v', at: n.tau, label: 'τ' }, { type: 'v', at: n.tFifth, label: 'τ ln 5', color: '#56b4e9' }, { type: 'h', at: n.Q / 5, label: 'Q/5', color: '#56b4e9' }]);
      view.set({ highlight: new Set(['C']) });
    },
    highlight(ids) { if (view) view.set({ highlight: new Set(ids) }); },
    frame(dt) {
      if (!view || !runner) return;
      runner.frame(dt);
      if (!runner.playing && tc.playing) tc.setPlaying(false);
      const st = runner.state;
      view.setSolution(runner.ok ? st : null);
      if (st) {
        const L = kind === 'ex1'
          ? { B: f(p.emf, 'V'), R1: f(p.R1, 'Ω'), R2: f(p.R2, 'Ω'), C: [f(p.C, 'F'), `q = ${f(st.q.C, 'C')}`], S: ['S', f(Math.abs(st.I.S), 'A')] }
          : { B: f(p.emf, 'V'), S: 'S', R1: f(p.R1, 'Ω'), R2: [f(p.R2, 'Ω'), f(Math.abs(st.I.R2), 'A')], R3: f(p.R3, 'Ω'), C: [f(p.C, 'F'), `q = ${f(st.q.C, 'C')}`] };
        view.set({ labels: L, hmLabels: { B: 'ε', R1: 'R₁', R2: 'R₂', R3: 'R₃', C: 'q/C' } });
        tc.setClock(`t = ${f(Math.max(0, runner.t - (runner.t0 || 0)), 's')}`);
      }
      view.frame(runner.playing ? dt : 0);
      plots.q.draw();
      plots.i.draw();
    },
  };
  void solveDC;
  void rcEx2Numbers;
  return ctx;
}
