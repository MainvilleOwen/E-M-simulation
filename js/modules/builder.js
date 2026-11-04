// Circuit builder: place batteries, resistors, bulbs, capacitors, switches and wires on a grid,
// connect them however you like, and tap any part to see its voltage and current over time.
import { h } from '../ui/dom.js';
import { viewBody, ctrlCard, placeResponsive } from '../ui/module-shell.js';
import { CircuitView, bindLayout } from '../ui/circuit-view.js';
import { slider, segmented, readouts, timeControls } from '../ui/controls.js';
import { LivePlot } from '../ui/plot.js';
import { TransientRunner } from '../ui/transient-runner.js';
import { COLORS } from '../ui/colors.js';
import { estimateTimeConstants } from '../core/circuit.js';
import { formatSI } from '../core/format.js';

const f = formatSI;
const COLS = 9;
const ROWS = 6;
const G = 12; // layout units between grid points
const gx = (c) => 6 + c * G;
const gy = (r) => 6 + r * G;
const BOX = { x: 0, y: 0, w: gx(COLS - 1) + 6, h: gy(ROWS - 1) + 6 };
const WIRE_R = 1e-3;     // an ideal wire, as a tiny resistance so its current is known
const GMIN_R = 1e9;      // a huge resistance from every node to ground, so nothing floats
const STORE = 'emlab.builder.v2';
const HIST = 600;

const KINDS = {
  wire: { label: 'Wire' },
  resistor: { label: 'Resistor', unit: 'Ω', min: 1, max: 100e3, value: 100, log: true },
  bulb: { label: 'Bulb', unit: 'Ω', min: 1, max: 10e3, value: 10, log: true },
  battery: { label: 'Battery', unit: 'V', min: 1, max: 24, value: 9 },
  capacitor: { label: 'Capacitor', unit: 'F', min: 1e-6, max: 1e-3, value: 100e-6, log: true },
  switch: { label: 'Switch' },
};

const EXAMPLE = [
  { kind: 'battery', a: [1, 4], b: [1, 1], value: 9 },
  { kind: 'wire', a: [1, 1], b: [2, 1] },
  { kind: 'switch', a: [2, 1], b: [4, 1], closed: true },
  { kind: 'wire', a: [4, 1], b: [5, 1] },
  { kind: 'resistor', a: [5, 1], b: [7, 1], value: 1000 },
  { kind: 'capacitor', a: [7, 1], b: [7, 4], value: 1e-3 },
  { kind: 'bulb', a: [4, 1], b: [4, 4], value: 50 },
  { kind: 'wire', a: [7, 4], b: [4, 4] },
  { kind: 'wire', a: [4, 4], b: [1, 4] },
];

let uid = 0;
const newId = (kind) => `${kind[0].toUpperCase()}${++uid}`;

function loadParts() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map((x) => ({ ...x, id: newId(x.kind) })); }
  } catch { /* ignore */ }
  return EXAMPLE.map((x) => ({ ...x, id: newId(x.kind) }));
}

function saveParts(parts) {
  try { localStorage.setItem(STORE, JSON.stringify(parts.map(({ id, ...rest }) => { void id; return rest; }))); } catch { /* ignore */ }
}

const node = ([c, r]) => `n${c}_${r}`;

/** Turn the placed parts into a circuit for the solver. */
function toCircuit(parts, charges) {
  const elements = [];
  const used = new Set();
  let ground = null;
  for (const p of parts) {
    const a = node(p.a);
    const b = node(p.b);
    used.add(a); used.add(b);
    if (p.kind === 'wire') elements.push({ type: 'R', id: p.id, a, b, R: WIRE_R });
    else if (p.kind === 'resistor' || p.kind === 'bulb') elements.push({ type: 'R', id: p.id, a, b, R: p.value });
    else if (p.kind === 'battery') { elements.push({ type: 'V', id: p.id, neg: a, pos: b, V: p.value }); if (!ground) ground = a; }
    else if (p.kind === 'capacitor') elements.push({ type: 'C', id: p.id, a, b, C: p.value, q0: charges[p.id] || 0 });
    else if (p.kind === 'switch') elements.push({ type: 'S', id: p.id, a, b, closed: !!p.closed });
  }
  ground = ground || [...used][0] || 'n0_0';
  for (const n of used) if (n !== ground) elements.push({ type: 'R', id: `__g_${n}`, a: n, b: ground, R: GMIN_R });
  return { ground, elements };
}

/** Turn the parts into a schematic layout (every part, wires included, is an element). */
function toLayout(parts, circuit) {
  const elements = {};
  const degree = new Map();
  for (const p of parts) {
    elements[p.id] = { kind: p.kind, a: [gx(p.a[0]), gy(p.a[1])], b: [gx(p.b[0]), gy(p.b[1])], labelSide: p.a[1] === p.b[1] ? 1 : -1 };
    for (const e of [p.a, p.b]) degree.set(node(e), (degree.get(node(e)) || 0) + 1);
  }
  const junctions = [];
  for (const [n, d] of degree) {
    if (d < 3) continue;
    const [c, r] = n.slice(1).split('_').map(Number);
    junctions.push({ at: [gx(c), gy(r)], node: n });
  }
  const layout = { w: BOX.w, h: BOX.h, padTop: 30, elements, wires: [], junctions };
  return bindLayout(layout, circuit);
}

export function mount(root, life) {
  root.append(
    h('header', { class: 'module-head' }, h('h1', {}, 'Circuit builder'),
      h('p', {}, 'Build any circuit. Pick a part, then tap two grid points in the same row or column (or drag between them). With Select: tap a part to see its graphs, drag it to move it, tap a switch to open or close it. Delete removes a part (or press Delete).')));
  const { sim, ctrl } = viewBody(root);
  let parts = loadParts();
  let selected = null;
  let tool = 'select';
  let pending = null;
  let charges = {};
  let history = new Map();
  let circuit = null;
  let tBase = 0;        // sim time carried across rebuilds, so edits never restart the clock
  let shortWarned = false;
  let drag = null;      // moving a part: { p, start, dc, dr }

  const scales = { vMin: 0, vMax: 10, dotK: 10, vmax: 60, pushPerVolt: 1.2, pRef: 2, qPerMark: 1e-4, maxMarks: 14 };
  const view = new CircuitView(sim, life, {
    layout: { w: BOX.w, h: BOX.h, elements: {}, wires: [] }, pieces: [], scales, box: BOX, heightMap: false,
    dotsNote: true, minHeight: 260, maxHeight: 420, aspect: 0.62, label: 'Circuit builder canvas',
  });
  view.schem.canvas.classList.add('draggable', 'builder-canvas');
  const warnText = h('span');
  const warnClose = h('button', { type: 'button', class: 'btn btn-ghost warn-close', 'aria-label': 'Dismiss message' }, '×');
  const warn = h('div', { class: 'note builder-warn', hidden: true, role: 'status' }, warnText, warnClose);
  warnClose.addEventListener('click', () => { warn.hidden = true; });
  sim.appendChild(warn);

  // Toolbar
  const toolSeg = segmented({
    label: 'Tool', value: 'select',
    options: [
      { value: 'select', label: 'Select' }, { value: 'wire', label: 'Wire' }, { value: 'battery', label: 'Battery' },
      { value: 'resistor', label: 'Resistor' }, { value: 'bulb', label: 'Bulb' }, { value: 'capacitor', label: 'Capacitor' },
      { value: 'switch', label: 'Switch' }, { value: 'delete', label: 'Delete' },
    ],
    onChange: (v) => { tool = v; pending = null; },
  });
  const clearBtn = h('button', { type: 'button', class: 'btn builder-clear' }, 'Clear all');
  const exampleBtn = h('button', { type: 'button', class: 'btn builder-example' }, 'Load example');
  clearBtn.addEventListener('click', () => { parts = []; selected = null; rebuild(); });
  exampleBtn.addEventListener('click', () => { parts = EXAMPLE.map((x) => ({ ...x, id: newId(x.kind) })); selected = null; charges = {}; rebuild(); });
  const runner = new TransientRunner({ timeScale: 1 });
  const tc = timeControls({
    onPlay: () => { runner.playing = true; },
    onPause: () => { runner.playing = false; },
    onReset: () => { charges = {}; history = new Map(); tBase = 0; if (runner.sim) runner.sim = null; rebuild(); },
    onSpeed: (v) => { runner.speed = v; },
  });
  const clockNote = h('p', { class: 'small muted' });
  const delBtn = h('button', { type: 'button', class: 'btn builder-delete', disabled: true }, 'Delete selected');
  delBtn.addEventListener('click', () => deleteSelected());
  const buildCard = ctrlCard(ctrl, 'Build', toolSeg.el, h('div', { class: 'btn-row' }, delBtn, exampleBtn, clearBtn));
  placeResponsive(buildCard, { wideParent: ctrl, narrowParent: sim, narrowAfter: warn }, life);
  const switchList = h('div', { class: 'switch-list' });
  ctrlCard(ctrl, 'Run', tc.el, clockNote, switchList);

  function toggleSwitch(p) {
    p.closed = !p.closed;
    updateValues();
    renderSwitches();
    if (selected === p.id) renderInspector();
  }

  /** Apply value changes (R, ε, C, switch state) to the running sim without restarting it. */
  function updateValues() {
    saveParts(parts);
    if (!circuit || !runner.sim) { rebuild(true); return; }
    for (const p of parts) {
      const el = circuit.elements.find((e) => e.id === p.id);
      if (!el) continue;
      if (p.kind === 'resistor' || p.kind === 'bulb') el.R = p.value;
      else if (p.kind === 'battery') el.V = p.value;
      else if (p.kind === 'capacitor') {
        const c = runner.sim.caps.get(p.id);
        if (c) c.v = (c.v * el.C) / p.value; // the charge stays; its voltage q/C changes
        el.C = p.value;
      } else if (p.kind === 'switch') el.closed = !!p.closed;
    }
    runner.sim.ok = true;
    runner.rebuild();
    pace();
    view.set({ labels: labelsFor() });
    shortWarned = false;
  }

  function labelsFor() {
    const labels = {};
    for (const p of parts) {
      if (p.kind === 'wire') continue;
      labels[p.id] = p.kind === 'switch' ? `${p.id} ${p.closed ? 'closed' : 'open'}` : f(p.value, KINDS[p.kind].unit);
    }
    return labels;
  }

  /** Pace the clock so the slowest real time constant takes about 3 s on screen. */
  function pace() {
    const modes = estimateTimeConstants(circuit).modes.filter((t) => t > 0 && t < 1e3);
    const tauSlow = modes.length ? modes[modes.length - 1] : 0;
    runner.timeScale = tauSlow > 0 ? tauSlow / 3 : 1;
    if (runner.sim && modes.length) runner.sim.setDt(Math.max(modes[0] / 200, tauSlow / 2000));
    clockNote.textContent = tauSlow > 0
      ? `Clock: 1 s on screen = ${f(runner.timeScale, 's')} of real time (slowest time constant ${f(tauSlow, 's')}).`
      : 'No capacitors charging: the currents are steady.';
  }

  /** One Open/Close button per switch, so any switch can be flipped without hunting for it. */
  function renderSwitches() {
    const sws = parts.filter((p) => p.kind === 'switch');
    switchList.replaceChildren();
    if (!sws.length) return;
    switchList.appendChild(h('div', { class: 'control-label' }, 'Switches (or tap a switch on the circuit)'));
    for (const p of sws) {
      switchList.appendChild(h('div', { class: 'switch-row' },
        h('span', {}, `${p.id}: ${p.closed ? 'closed' : 'open'}`),
        h('button', { type: 'button', class: `btn ${p.closed ? '' : 'btn-primary'} switch-toggle`, data: { id: p.id }, on: { click: () => toggleSwitch(p) } },
          p.closed ? 'Open it' : 'Close it')));
    }
  }

  // Inspector for the selected part
  const inspector = ctrlCard(ctrl, 'Selected part');
  const insBody = h('div', { class: 'inspector' });
  inspector.appendChild(insBody);
  const plotHost = h('div', { class: 'plots builder-plots' });
  sim.appendChild(plotHost);
  const pV = new LivePlot(plotHost, life, { title: 'Voltage across the selected part', unit: 'V', color: COLORS.trace, minHeight: 130, maxHeight: 180 });
  const pI = new LivePlot(plotHost, life, { title: 'Current through the selected part', unit: 'A', color: COLORS.trace2, minHeight: 130, maxHeight: 180 });
  let ro = null;

  function deleteSelected() {
    if (!selected) return;
    parts = parts.filter((x) => x.id !== selected);
    selected = null;
    rebuild();
  }

  function renderInspector() {
    delBtn.disabled = !selected;
    insBody.replaceChildren();
    ro = null;
    const p = parts.find((x) => x.id === selected);
    plotHost.hidden = !p;
    if (!p) {
      insBody.appendChild(h('p', { class: 'muted' }, 'Choose Select, then tap a part on the circuit to see its voltage, current and power, with graphs over time.'));
      return;
    }
    const K = KINDS[p.kind];
    insBody.appendChild(h('p', {}, h('strong', {}, `${K.label} ${p.id}`)));
    if (K.unit) {
      insBody.appendChild(slider({ label: K.label === 'Battery' ? 'Voltage ε' : K.label === 'Capacitor' ? 'Capacitance C' : 'Resistance R', min: K.min, max: K.max, step: K.log ? undefined : 0.5, log: !!K.log, value: p.value, unit: K.unit, onInput: (v) => { p.value = v; updateValues(); } }).el);
    }
    const row = h('div', { class: 'btn-row' });
    if (p.kind === 'battery') row.appendChild(h('button', { type: 'button', class: 'btn', on: { click: () => { [p.a, p.b] = [p.b, p.a]; rebuild(true); } } }, 'Flip + and −'));
    if (p.kind === 'switch') row.appendChild(h('button', { type: 'button', class: 'btn btn-primary inspector-switch', on: { click: () => toggleSwitch(p) } }, p.closed ? 'Open the switch' : 'Close the switch'));
    if (p.kind === 'capacitor') row.appendChild(h('button', { type: 'button', class: 'btn', on: { click: () => { const c = runner.sim && runner.sim.caps.get(p.id); if (c) c.v = 0; charges[p.id] = 0; updateValues(); } } }, 'Discharge it'));
    row.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => deleteSelected() } }, 'Delete'));
    insBody.appendChild(row);
    const items = [
      { key: 'V', label: 'Voltage across', unit: 'V' },
      { key: 'I', label: 'Current through', unit: 'A' },
      { key: 'P', label: p.kind === 'battery' ? 'Power delivered' : 'Power', unit: 'W' },
    ];
    if (p.kind === 'capacitor') items.push({ key: 'q', label: 'Charge q', unit: 'C' }, { key: 'U', label: 'Energy stored', unit: 'J' });
    ro = readouts(items);
    insBody.appendChild(ro.el);
  }

  function rebuild(keepSelection = false) {
    // Keep capacitor charges across edits (charge does not vanish when you add a part)
    if (runner.sim && runner.sim.ok && runner.state) Object.assign(charges, runner.state.q);
    if (!keepSelection && selected && !parts.some((p) => p.id === selected)) selected = null;
    saveParts(parts);
    circuit = toCircuit(parts, charges);
    const layout = toLayout(parts, circuit);
    view.setLayout(layout, []);
    view.set({ labels: labelsFor(), highlight: new Set(selected ? [selected] : []) });
    renderSwitches();
    if (!parts.length) {
      view.setSolution(null);
      view.schem.showProblem('Add parts to start: pick a tool, then tap two grid points.');
      renderInspector();
      return;
    }
    const wasPlaying = runner.sim ? runner.playing : true;
    if (runner.sim) tBase += runner.sim.t;
    runner.load(circuit);
    pace();
    runner.playing = wasPlaying;
    tc.setPlaying(wasPlaying);
    shortWarned = false;
    // Scales for this circuit: colour range from the batteries, dot speed from the biggest current now
    const st = runner.state;
    if (st) {
      const vs = Object.entries(st.V).filter(([k]) => k.startsWith('n')).map(([, v]) => v);
      scales.vMin = Math.min(0, ...vs);
      scales.vMax = Math.max(1, ...vs);
      let iMax = 0;
      for (const p of parts) iMax = Math.max(iMax, Math.abs(st.I[p.id] || 0));
      scales.dotK = 30 / Math.max(iMax, 1e-6);
      let qMax = 0;
      for (const p of parts) if (p.kind === 'capacitor') qMax = Math.max(qMax, p.value * scales.vMax);
      scales.qPerMark = qMax > 0 ? qMax / 30 : 1;
      view.refreshLegend();
    }
    renderInspector();
  }

  // Pointer: place parts by tapping (or dragging between) grid points; select or delete by tapping a part
  const gridHit = (x, y) => {
    const T = view.transform();
    let best = null;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const [px, py] = T.p([gx(c), gy(r)]);
      const d = Math.hypot(px - x, py - y);
      if (d < Math.max(16, G * T.scale * 0.45) && (!best || d < best.d)) best = { c, r, d };
    }
    return best;
  };
  const partHit = (x, y) => {
    const T = view.transform();
    let best = null;
    for (const p of parts) {
      const [ax, ay] = T.p([gx(p.a[0]), gy(p.a[1])]);
      const [bx, by] = T.p([gx(p.b[0]), gy(p.b[1])]);
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
      const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
      if (d < 18 && (!best || d < best.d)) best = { p, d };
    }
    return best && best.p;
  };
  const place = (A, B) => {
    if (A.c === B.c && A.r === B.r) return false;
    if (A.c !== B.c && A.r !== B.r) { warnMsg('Parts go along a row or a column: pick two points in a line.'); return false; }
    const a = [A.c, A.r];
    const b = [B.c, B.r];
    const same = (p) => (p.a + '' === a + '' && p.b + '' === b + '') || (p.a + '' === b + '' && p.b + '' === a + '');
    parts = parts.filter((p) => !same(p));
    const K = KINDS[tool];
    const p = { id: newId(tool), kind: tool, a, b, value: K.value, closed: tool === 'switch' ? true : undefined };
    parts.push(p);
    selected = p.id;
    rebuild();
    return true;
  };
  let down = null;
  life.on(view.schem.canvas, 'pointerdown', (ev) => {
    const { x, y } = view.schem.local(ev);
    down = { x, y, g: gridHit(x, y) };
    if (tool === 'select') {
      const p = partHit(x, y);
      if (p) { drag = { p, x, y, dc: 0, dr: 0 }; view.schem.canvas.setPointerCapture(ev.pointerId); }
    }
  });
  life.on(view.schem.canvas, 'pointermove', (ev) => {
    if (!drag) return;
    const { x, y } = view.schem.local(ev);
    const step = G * view.transform().scale;
    const dc = Math.round((x - drag.x) / step);
    const dr = Math.round((y - drag.y) / step);
    const fits = [drag.p.a, drag.p.b].every(([c, r]) => c + dc >= 0 && c + dc < COLS && r + dr >= 0 && r + dr < ROWS);
    if (fits) { drag.dc = dc; drag.dr = dr; }
  });
  life.on(view.schem.canvas, 'pointercancel', () => { drag = null; down = null; });
  life.on(document, 'keydown', (ev) => {
    if (!(ev.key === 'Delete' || ev.key === 'Backspace') || !selected) return;
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    ev.preventDefault();
    deleteSelected();
  });
  life.on(view.schem.canvas, 'pointerup', (ev) => {
    if (!down) return;
    const { x, y } = view.schem.local(ev);
    const g = gridHit(x, y);
    const start = down;
    down = null;
    if (drag) {
      const d = drag;
      drag = null;
      if (d.dc || d.dr) {
        d.p.a = [d.p.a[0] + d.dc, d.p.a[1] + d.dr];
        d.p.b = [d.p.b[0] + d.dc, d.p.b[1] + d.dr];
        selected = d.p.id;
        rebuild(true);
        return;
      }
    }
    if (tool === 'select' || tool === 'delete') {
      const p = partHit(x, y);
      if (tool === 'delete' && p) { parts = parts.filter((q) => q !== p); if (selected === p.id) selected = null; rebuild(); return; }
      selected = p ? p.id : null;
      if (p && p.kind === 'switch' && tool === 'select') { toggleSwitch(p); return; } // tap a switch to flip it
      view.set({ highlight: new Set(selected ? [selected] : []) });
      renderInspector();
      return;
    }
    if (start.g && g && (start.g.c !== g.c || start.g.r !== g.r)) { pending = null; place(start.g, g); return; }
    if (!g) return;
    if (pending) { const A = pending; pending = null; if (!place(A, g)) pending = (A.c === g.c && A.r === g.r) ? null : g; } else pending = g;
  });
  life.on(view.schem.canvas, 'touchstart', (ev) => ev.preventDefault(), { passive: false });

  let warnTimer = null;
  function warnMsg(t) {
    warnText.textContent = t;
    warn.hidden = false;
    if (warnTimer) clearTimeout(warnTimer);
    warnTimer = setTimeout(() => { warn.hidden = true; }, 5000);
  }
  life.add(() => { if (warnTimer) clearTimeout(warnTimer); });

  view.set({
    drawSchematicExtra: (ctx, T) => {
      ctx.save();
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        const [px, py] = T.p([gx(c), gy(r)]);
        ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,210,230,0.35)'; ctx.fill();
      }
      if (drag && (drag.dc || drag.dr)) {
        const [ax, ay] = T.p([gx(drag.p.a[0] + drag.dc), gy(drag.p.a[1] + drag.dr)]);
        const [bx, by] = T.p([gx(drag.p.b[0] + drag.dc), gy(drag.p.b[1] + drag.dr)]);
        ctx.setLineDash([6, 5]); ctx.strokeStyle = '#f0e442'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      }
      if (pending) {
        const [px, py] = T.p([gx(pending.c), gy(pending.r)]);
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#f0e442'; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();
    },
  });

  // Test hook: screen position of a grid point
  if (window.__emlab) {
    window.__emlab.builderPoint = (c, r) => {
      const T = view.transform();
      const rect = view.schem.canvas.getBoundingClientRect();
      const [x, y] = T.p([6 + c * G, 6 + r * G]);
      return { x: rect.left + x, y: rect.top + y };
    };
    life.add(() => { delete window.__emlab.builderPoint; });
  }

  rebuild();
  life.frame((dt) => {
    runner.frame(dt);
    if (!runner.playing && tc.playing) tc.setPlaying(false);
    const st = runner.sim && runner.sim.ok ? runner.state : null;
    if (parts.length) view.setSolution(st);
    let shorted = false;
    if (st) {
      for (const p of parts) {
        const el = circuit.elements.find((e) => e.id === p.id);
        const a = p.kind === 'battery' ? el.neg : el.a;
        const b = p.kind === 'battery' ? el.pos : el.b;
        const V = p.kind === 'battery' ? st.V[b] - st.V[a] : st.V[a] - st.V[b];
        const I = st.I[p.id] || 0;
        if (Math.abs(I) > 100) shorted = true;
        let hist = history.get(p.id);
        if (!hist) { hist = []; history.set(p.id, hist); }
        const last = hist[hist.length - 1];
        const tt = tBase + st.t;
        if (!last || tt > last[0]) { hist.push([tt, V, I]); if (hist.length > HIST) hist.shift(); }
        if (p.id === selected && ro) {
          ro.set('V', V); ro.set('I', Math.abs(I));
          ro.set('P', p.kind === 'battery' ? I * V : Math.abs(I * V));
          if (p.kind === 'capacitor') { ro.set('q', st.q[p.id] || 0); ro.set('U', 0.5 * p.value * V * V); }
        }
      }
      tc.setClock(`t = ${f(tBase + st.t, 's')}`);
    }
    if (shorted && !shortWarned) { shortWarned = true; warnMsg('Short circuit: a wire connects across a battery, so the current is huge. Add a resistor.'); }
    const hist = selected && history.get(selected);
    if (hist && hist.length > 1 && !plotHost.hidden) {
      const t0 = hist[0][0];
      const span = Math.max(hist[hist.length - 1][0] - t0, 1e-9);
      for (const [plot, k] of [[pV, 1], [pI, 2]]) {
        plot.data = hist.map((row) => [row[0] - t0, row[k]]);
        let lo = Math.min(0, ...plot.data.map((d) => d[1]));
        let hi = Math.max(0, ...plot.data.map((d) => d[1]));
        if (hi - lo < 1e-12) { hi += 1e-3; lo -= 0; }
        plot.setAxes({ tMax: span, yMin: lo, yMax: hi + (hi - lo) * 0.1 });
        plot.draw();
      }
    }
    view.frame(runner.playing ? dt : 0);
  });
  return { unmount() {} };
}
