// M4. Fields and dipoles (lightweight): superposition sandbox and a dipole in a uniform field.
import { h, infoNote } from '../ui/dom.js';
import { moduleShell, viewBody, ctrlCard } from '../ui/module-shell.js';
import { slider, segmented, readouts, equationReveal, linkSymbols } from '../ui/controls.js';
import { solveRunner } from '../ui/solve-runner.js';
import { Stage } from '../ui/stage.js';
import { COLORS, rgba } from '../ui/colors.js';
import { arrow, label } from '../ui/schematic.js';
import {
  fieldAt, fieldContributions, potentialAt, arrowLength, fieldLines, dipoleForces, dipoleEnergy, stepDipole, wrapAngle,
} from '../core/fields.js';
import { formatSI, formatNum } from '../core/format.js';
import { FIELD_PROBLEMS } from '../content/problems.js';

const f = formatSI;
const nC = 1e-9;
const SOFT = 0.003;               // m: softening near point charges (no infinities)
const ARROW_SCALE = { minMag: 300, maxMag: 3e5 };

export function mount(root, life, sub) {
  return moduleShell(root, life, {
    route: 'fields',
    title: 'Fields and dipoles',
    question: 'How do the fields of several charges add up, and why does a dipole twist but not move?',
    initial: sub ? sub.split('/')[0] : 'sandbox',
    views: [
      { id: 'sandbox', label: 'Field sandbox', mount: mountSandbox },
      { id: 'dipole', label: 'Dipole in a field', mount: mountDipole },
      { id: 'solve', label: 'Solve', mount: mountSolve },
    ],
  });
}

// ---------------------------------------------------------------------------
// Sandbox renderer
// ---------------------------------------------------------------------------
export class FieldCanvas {
  /**
   * @param stage   Stage
   * @param state   { charges: [{x,y,q}], probe: {x,y}, lines: bool, guides: bool, center: [x,y], width: m }
   */
  constructor(stage, state) {
    this.stage = stage;
    this.s = state;
    this.lineCache = null;
    this.dirty = true;
    this.show = { grid: true, parts: true, sum: true, distance: false, components: false };
  }

  get width() { return this.s.width || 0.12; }
  get scale() { return this.stage.w / this.width; }
  get height() { return this.stage.h / this.scale; }
  px(x, y) {
    const [cx, cy] = this.s.center || [0, 0];
    return [this.stage.w / 2 + (x - cx) * this.scale, this.stage.h / 2 - (y - cy) * this.scale];
  }
  world(px, py) {
    const [cx, cy] = this.s.center || [0, 0];
    return [(px - this.stage.w / 2) / this.scale + cx, -(py - this.stage.h / 2) / this.scale + cy];
  }
  bounds() {
    const [x0, y1] = this.world(0, 0);
    const [x1, y0] = this.world(this.stage.w, this.stage.h);
    return { x0, y0, x1, y1 };
  }
  invalidate() { this.lineCache = null; this.dirty = true; }

  hit(px, py) {
    let best = null;
    this.s.charges.forEach((c, i) => {
      const [x, y] = this.px(c.x, c.y);
      const d = Math.hypot(px - x, py - y);
      if (d < 26 && (!best || d < best.d)) best = { kind: 'charge', i, d };
    });
    if (this.s.probe) {
      const [x, y] = this.px(this.s.probe.x, this.s.probe.y);
      const d = Math.hypot(px - x, py - y);
      if (d < 28 && (!best || d < best.d)) best = { kind: 'probe', d };
    }
    return best;
  }

  draw() {
    const st = this.stage;
    const ctx = st.begin(COLORS.panel);
    const W = st.w;
    const H = st.h;
    const charges = this.s.charges;
    // Arrow grid (log-scaled, clamped)
    if (this.show.grid && charges.length) {
      const sp = Math.max(26, Math.min(40, W / 12));
      for (let gy = sp / 2; gy < H; gy += sp) {
        for (let gx = sp / 2; gx < W; gx += sp) {
          const [wx, wy] = this.world(gx, gy);
          const E = fieldAt(charges, wx, wy, SOFT);
          const m = Math.hypot(E.Ex, E.Ey);
          if (!(m > 0)) continue;
          const L = arrowLength(m, { ...ARROW_SCALE, minLen: 5, maxLen: sp * 0.8 });
          const ux = E.Ex / m;
          const uy = -E.Ey / m;
          const fr = Math.max(0, Math.min(1, Math.log(m / ARROW_SCALE.minMag) / Math.log(ARROW_SCALE.maxMag / ARROW_SCALE.minMag)));
          arrow(ctx, gx - (ux * L) / 2, gy - (uy * L) / 2, gx + (ux * L) / 2, gy + (uy * L) / 2,
            { color: `rgba(200,210,230,${0.3 + 0.6 * fr})`, width: 1.6, head: Math.min(6, L * 0.45) });
        }
      }
    }
    // Field lines
    if (this.s.lines && charges.length) {
      if (!this.lineCache) {
        const b = this.bounds();
        this.lineCache = fieldLines(charges, {
          bounds: { x0: b.x0 - 0.01, y0: b.y0 - 0.01, x1: b.x1 + 0.01, y1: b.y1 + 0.01 },
          step: this.width / 300, maxSteps: 900, soft: 0.0015, stopRadius: 0.0035, startRadius: 0.004, linesPerUnit: 4, unit: nC,
        });
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(240,228,66,0.55)';
      ctx.lineWidth = 1.6;
      for (const ln of this.lineCache) {
        ctx.beginPath();
        ln.pts.forEach(([x, y], i) => { const [px, py] = this.px(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
      }
      ctx.restore();
    }
    // Dipole guides
    if (this.s.guides && charges.length === 2) {
      const [a, b] = charges;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const big = this.width;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(86,180,233,0.6)';
      ctx.lineWidth = 1.5;
      const seg = (x0, y0, x1, y1) => { const p0 = this.px(x0, y0); const p1 = this.px(x1, y1); ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke(); };
      seg(mx - (dx / L) * big, my - (dy / L) * big, mx + (dx / L) * big, my + (dy / L) * big);
      seg(mx + (dy / L) * big, my - (dx / L) * big, mx - (dy / L) * big, my + (dx / L) * big);
      ctx.restore();
      const [ax, ay] = this.px(mx + (dx / L) * this.width * 0.38, my + (dy / L) * this.width * 0.38);
      label(ctx, 'axis', ax, ay - 12, { size: 12, color: '#56b4e9' });
      const [bx, by] = this.px(mx - (dy / L) * this.height * 0.4, my + (dx / L) * this.height * 0.4);
      label(ctx, 'bisector', bx + 30, by, { size: 12, color: '#56b4e9' });
    }
    // Distances (solve step)
    if (this.show.distance && this.s.probe) {
      const [qx, qy] = this.px(this.s.probe.x, this.s.probe.y);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0,200,150,0.8)';
      ctx.lineWidth = 2;
      for (const c of charges) { const [x, y] = this.px(c.x, c.y); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(qx, qy); ctx.stroke(); }
      ctx.restore();
    }
    // Charges
    charges.forEach((c, i) => {
      const [x, y] = this.px(c.x, c.y);
      const r = 10 + 3 * Math.sqrt(Math.abs(c.q) / nC);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = c.q > 0 ? COLORS.pos : COLORS.neg;
      ctx.fill();
      ctx.lineWidth = this.s.selected === i ? 3 : 1.5;
      ctx.strokeStyle = this.s.selected === i ? '#ffffff' : '#0b0f18';
      ctx.stroke();
      ctx.fillStyle = '#0b0f18';
      ctx.font = `700 ${Math.round(r * 1.2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.q > 0 ? '+' : '−', x, y + 1);
      label(ctx, `q${'₁₂₃₄'[i]} ${c.q > 0 ? '+' : '−'}${formatNum(Math.abs(c.q) / nC, 2)} nC`, x, y + r + 12, { size: 12 });
    });
    // Probe with contributions and their vector sum (linear scale so they add tip-to-tail)
    if (this.s.probe) {
      const p = this.s.probe;
      const [px, py] = this.px(p.x, p.y);
      const parts = fieldContributions(charges, p.x, p.y, SOFT);
      const E = fieldAt(charges, p.x, p.y, SOFT);
      const mags = parts.map((e) => Math.hypot(e.Ex, e.Ey)).concat([Math.hypot(E.Ex, E.Ey)]);
      const maxL = Math.min(W, H) * 0.24;
      const k = maxL / Math.max(...mags, 1e-30);
      if (this.show.parts) {
        let tx = px;
        let ty = py;
        parts.forEach((e, i) => {
          const c = charges[i].q > 0 ? COLORS.pos : COLORS.neg;
          arrow(ctx, px, py, px + e.Ex * k, py - e.Ey * k, { color: rgba(c, 0.95), width: 3, head: 9 });
          if (this.show.sum && parts.length > 1) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = rgba(c, 0.55);
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + e.Ex * k, ty - e.Ey * k); ctx.stroke();
            ctx.restore();
          }
          tx += e.Ex * k; ty -= e.Ey * k;
        });
      }
      if (this.show.sum) arrow(ctx, px, py, px + E.Ex * k, py - E.Ey * k, { color: '#ffffff', width: 4.5, head: 12 });
      if (this.show.components) {
        ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + E.Ex * k, py); ctx.lineTo(px + E.Ex * k, py - E.Ey * k); ctx.stroke(); ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#f0e442';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 13, py); ctx.lineTo(px + 13, py); ctx.moveTo(px, py - 13); ctx.lineTo(px, py + 13);
      ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, 'probe', px, py + 22, { size: 12, color: '#f0e442' });
    }
    // Scale bar
    const barM = 0.01;
    const [b0x] = this.px(0, 0);
    const [b1x] = this.px(barM, 0);
    const len = b1x - b0x;
    ctx.strokeStyle = COLORS.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, H - 12); ctx.lineTo(12 + len, H - 12); ctx.stroke();
    label(ctx, '1 cm', 12 + len / 2, H - 24, { size: 11, color: COLORS.muted, bg: null });
  }
}

/** Drag charges and the probe; tap empty space to move the probe there. */
function attachDrag(fc, life, onChange) {
  const canvas = fc.stage.canvas;
  let drag = null;
  life.on(canvas, 'pointerdown', (ev) => {
    const { x, y } = fc.stage.local(ev);
    const hit = fc.hit(x, y);
    if (hit) drag = hit;
    else if (fc.s.probe) { drag = { kind: 'probe' }; }
    if (!drag) return;
    canvas.setPointerCapture(ev.pointerId);
    if (drag.kind === 'charge') fc.s.selected = drag.i;
    move(ev);
  });
  const move = (ev) => {
    if (!drag) return;
    const { x, y } = fc.stage.local(ev);
    const [wx, wy] = fc.world(Math.max(8, Math.min(fc.stage.w - 8, x)), Math.max(8, Math.min(fc.stage.h - 8, y)));
    if (drag.kind === 'charge') { fc.s.charges[drag.i].x = wx; fc.s.charges[drag.i].y = wy; fc.invalidate(); } else { fc.s.probe.x = wx; fc.s.probe.y = wy; fc.dirty = true; }
    onChange(drag.kind);
  };
  life.on(canvas, 'pointermove', move);
  const end = () => { drag = null; };
  life.on(canvas, 'pointerup', end);
  life.on(canvas, 'pointercancel', end);
  // On touch, a drag that starts on a charge or the probe should not scroll the page.
  // Touches elsewhere still scroll (a tap there moves the probe).
  life.on(canvas, 'touchstart', (ev) => {
    const t = ev.touches[0];
    if (!t) return;
    const { x, y } = fc.stage.local(t);
    if (fc.hit(x, y)) ev.preventDefault();
  }, { passive: false });
}

// ---------------------------------------------------------------------------
// Sandbox view
// ---------------------------------------------------------------------------
const PRESETS = {
  single: () => [{ x: 0, y: 0, q: 2 * nC }],
  dipole: () => [{ x: -0.015, y: 0, q: -2 * nC }, { x: 0.015, y: 0, q: 2 * nC }],
  like: () => [{ x: -0.02, y: 0, q: 2 * nC }, { x: 0.02, y: 0, q: 2 * nC }],
  four: () => [{ x: -0.025, y: 0.018, q: 3 * nC }, { x: 0.025, y: 0.018, q: -1 * nC }, { x: -0.02, y: -0.02, q: -2 * nC }, { x: 0.022, y: -0.015, q: 1 * nC }],
};

function mountSandbox(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'Each charge makes its own field: E = kq/r², pointing away from + and toward −. The total field is the vector sum. Drag the charges and the probe; tap anywhere to move the probe.');
  const state = { charges: PRESETS.dipole(), probe: { x: 0, y: 0.018 }, lines: false, guides: true, selected: null, width: 0.12 };
  const panel = h('div', { class: 'circuit-view field-panel' });
  sim.appendChild(panel);
  const stage = new Stage(panel, life, { aspect: 0.72, minHeight: 280, maxHeight: 460, label: 'Electric field of point charges, with a probe' });
  stage.canvas.classList.add('draggable');
  panel.appendChild(h('div', { class: 'panel-note' },
    h('span', {}, 'Grey arrows: field direction (length log-scaled).'),
    infoNote('Real fields near a charge are thousands of times stronger than far away, so grid arrow length grows with the logarithm of |E| and is clamped. At the probe, the coloured arrows are each charge’s own field and the white arrow is their sum; those use a linear scale so they add tip to tail (dashed).', { label: 'About the arrows' })));
  const fc = new FieldCanvas(stage, state);
  const ro = readouts([
    { key: 'E', label: '|E| at the probe', unit: 'N/C', sym: 'E' },
    { key: 'dir', label: 'Direction of E', format: (v) => (Number.isFinite(v) ? `${formatNum(v, 3)}° from +x` : '—') },
    { key: 'V', label: 'Potential V at the probe', unit: 'V' },
  ]);
  const parts = h('ul', { class: 'parts-list' });
  const why = h('div', { class: 'why-note' });
  const listHost = h('div', { class: 'charge-list' });
  const addBtn = h('button', { type: 'button', class: 'btn add-charge' }, 'Add a charge');
  const presetSeg = segmented({
    label: 'Preset', value: 'dipole',
    options: [{ value: 'single', label: 'One' }, { value: 'dipole', label: 'Dipole' }, { value: 'like', label: 'Like pair' }, { value: 'four', label: 'Four' }],
    onChange: (v) => { state.charges = PRESETS[v](); state.guides = v === 'dipole'; state.probe = { x: 0, y: 0.018 }; state.selected = null; fc.invalidate(); renderList(); update(); },
  });
  const linesSeg = segmented({
    label: 'Field lines', value: 'off', small: true,
    options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
    onChange: (v) => { state.lines = v === 'on'; fc.invalidate(); },
  });
  const axisBtn = h('button', { type: 'button', class: 'btn probe-axis' }, 'Probe on the axis');
  const bisBtn = h('button', { type: 'button', class: 'btn probe-bisector' }, 'Probe on the bisector');
  axisBtn.addEventListener('click', () => { if (state.charges.length === 2) { const [a, b] = state.charges; const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; state.probe = { x: mx + ((b.x - a.x) / L) * 0.035, y: my + ((b.y - a.y) / L) * 0.035 }; update(); } });
  bisBtn.addEventListener('click', () => { if (state.charges.length === 2) { const [a, b] = state.charges; const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; state.probe = { x: mx - ((b.y - a.y) / L) * 0.02, y: my + ((b.x - a.x) / L) * 0.02 }; update(); } });
  const dipoleRow = h('div', { class: 'btn-row dipole-probes' }, axisBtn, bisBtn);
  addBtn.addEventListener('click', () => {
    if (state.charges.length >= 4) return;
    const spots = [[0, -0.03], [0.03, 0.03], [-0.03, -0.03], [0.035, -0.02]];
    const [x, y] = spots[state.charges.length];
    state.charges.push({ x, y, q: (state.charges.length % 2 ? -1 : 1) * nC });
    state.guides = false;
    fc.invalidate(); renderList(); update();
  });
  const eq = equationReveal('<span class="sym" data-sym="E"><b>E</b></span> = <b>E</b><sub>1</sub> + <b>E</b><sub>2</sub> + … , &nbsp; |<b>E</b><sub>i</sub>| = k|q<sub>i</sub>| / r<sub>i</sub><sup>2</sup>', { note: 'Add the vectors, not the magnitudes: split each into x and y parts, add the parts.' });
  const chargesCard = ctrlCard(ctrl, 'Charges', presetSeg.el, listHost, addBtn, linesSeg.el, dipoleRow);
  const measure = h('section', { class: 'ctrl-card' }, h('h3', {}, 'At the probe'), ro.el, parts, why, eq.el);
  sim.appendChild(measure);
  void chargesCard;

  function renderList() {
    listHost.replaceChildren();
    const sub = '₁₂₃₄';
    state.charges.forEach((c, i) => {
      const signSeg = segmented({
        label: `q${sub[i]}`, value: c.q > 0 ? '+' : '-', small: true,
        options: [{ value: '+', label: '+' }, { value: '-', label: '−' }],
        onChange: (v) => { c.q = (v === '+' ? 1 : -1) * Math.abs(c.q); fc.invalidate(); update(); },
      });
      const mag = slider({ label: `|q${sub[i]}|`, min: 0.5, max: 5, step: 0.5, value: Math.abs(c.q) / nC, format: (v) => `${formatNum(v, 2)} nC`, onInput: (v) => { c.q = Math.sign(c.q) * v * nC; fc.invalidate(); update(); } });
      const rm = h('button', { type: 'button', class: 'btn btn-ghost remove-charge', 'aria-label': `Remove q${sub[i]}` }, 'Remove');
      rm.disabled = state.charges.length <= 1;
      rm.addEventListener('click', () => { state.charges.splice(i, 1); state.guides = false; state.selected = null; fc.invalidate(); renderList(); update(); });
      listHost.appendChild(h('div', { class: 'charge-row' }, h('div', { class: 'charge-row-head' }, signSeg.el, rm), mag.el));
    });
    addBtn.disabled = state.charges.length >= 4;
    dipoleRow.hidden = !state.guides;
  }

  function update() {
    const p = state.probe;
    const E = fieldAt(state.charges, p.x, p.y, SOFT);
    const m = Math.hypot(E.Ex, E.Ey);
    ro.set('E', m);
    ro.set('dir', (Math.atan2(E.Ey, E.Ex) * 180) / Math.PI);
    ro.set('V', potentialAt(state.charges, p.x, p.y, SOFT));
    const contrib = fieldContributions(state.charges, p.x, p.y, SOFT);
    parts.replaceChildren(...contrib.map((e, i) => h('li', {}, `From q${'₁₂₃₄'[i]}: ${f(Math.hypot(e.Ex, e.Ey), 'N/C')}`)));
    const sumMags = contrib.reduce((s, e) => s + Math.hypot(e.Ex, e.Ey), 0);
    let text = `The white arrow is the vector sum. Its size (${f(m, 'N/C')}) is ${m < 0.98 * sumMags ? 'less than' : 'equal to'} the sum of the sizes (${f(sumMags, 'N/C')}) because the arrows ${m < 0.98 * sumMags ? 'point in different directions' : 'line up'}.`;
    if (state.guides && state.charges.length === 2) {
      const [a, b] = state.charges;
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const ax = b.x - a.x; const ay = b.y - a.y; const L = Math.hypot(ax, ay) || 1;
      const rx = p.x - mx; const ry = p.y - my;
      const along = Math.abs((rx * ax + ry * ay) / L);
      const across = Math.abs((rx * -ay + ry * ax) / L);
      if (across < 0.002) text = 'On the axis, both fields line up along the axis: the field points along the dipole (from − toward +, beyond the + end).';
      else if (along < 0.002) text = 'On the perpendicular bisector, the sideways parts cancel and the field points parallel to the axis, opposite the dipole moment (from + toward −).';
    }
    if (why.innerHTML !== text) why.innerHTML = text;
    fc.dirty = true;
  }

  attachDrag(fc, life, () => update());
  renderList();
  update();
  life.frame(() => {
    if (stage.visible && (fc.dirty || stage.dirty)) { fc.draw(); fc.dirty = false; stage.dirty = false; }
  });
}

// ---------------------------------------------------------------------------
// Dipole in a uniform field
// ---------------------------------------------------------------------------
const DIPOLE_D = 0.02; // m
const OMEGA0 = (2 * Math.PI) / 2.5; // natural period 2.5 s at the default settings
const INERTIA = (2 * nC * DIPOLE_D * 5e4) / (OMEGA0 * OMEGA0);

export class DipoleCanvas {
  constructor(stage, state) {
    this.stage = stage;
    this.s = state; // { q, E, theta, omega, show: {...} }
  }

  draw() {
    const st = this.stage;
    const ctx = st.begin(COLORS.panel);
    const W = st.w;
    const H = st.h;
    const s = this.s;
    const show = s.show || { forces: true, torque: true, p: true };
    // Uniform field lines (density ∝ E)
    const nLines = Math.max(3, Math.round(3 + (9 * s.E) / 1e5));
    for (let i = 0; i < nLines; i++) {
      const y = ((i + 0.5) / nLines) * H;
      arrow(ctx, 10, y, W - 10, y, { color: 'rgba(200,210,230,0.35)', width: 1.5, head: 8 });
    }
    label(ctx, `uniform field E = ${f(s.E, 'N/C')} →`, W - 10, 14, { size: 13, align: 'right', color: COLORS.muted });
    const cx = W / 2;
    const cy = H / 2;
    const L = Math.min(W, H) * 0.24;
    const th = s.theta;
    const px = cx + L * Math.cos(th);
    const py = cy - L * Math.sin(th);
    const mx = cx - L * Math.cos(th);
    const my = cy + L * Math.sin(th);
    // rod
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(px, py); ctx.stroke();
    // angle arc
    ctx.strokeStyle = 'rgba(240,228,66,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + L * 1.25, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, L * 0.45, 0, -wrapAngle(th), wrapAngle(th) > 0); ctx.stroke();
    label(ctx, `θ = ${formatNum(Math.abs((wrapAngle(th) * 180) / Math.PI), 3)}°`, cx + L * 0.55, cy - (wrapAngle(th) > 0 ? 16 : -16), { size: 13, color: '#f0e442', align: 'left' });
    // p arrow
    if (show.p) {
      arrow(ctx, cx - L * 0.5 * Math.cos(th), cy + L * 0.5 * Math.sin(th), cx + L * 0.5 * Math.cos(th), cy - L * 0.5 * Math.sin(th), { color: '#f0e442', width: 2.5, head: 9 });
      label(ctx, 'p', cx + L * 0.5 * Math.cos(th) + 10, cy - L * 0.5 * Math.sin(th) - 10, { size: 14, color: '#f0e442', bg: null });
    }
    // forces
    const fz = dipoleForces(s.q, DIPOLE_D, s.E, th);
    const fLen = Math.min(W * 0.18, 30 + (60 * s.q * s.E) / (5 * nC * 1e5));
    if (show.forces) {
      arrow(ctx, px, py, px + fLen, py, { color: COLORS.pos, width: 4, head: 11 });
      arrow(ctx, mx, my, mx - fLen, my, { color: COLORS.neg, width: 4, head: 11 });
      label(ctx, '+qE', px + fLen + 4, py - 14, { size: 13, color: COLORS.pos, align: 'left' });
      label(ctx, '−qE', mx - fLen - 4, my - 14, { size: 13, color: COLORS.neg, align: 'right' });
    }
    // charges
    for (const [x, y, q] of [[px, py, 1], [mx, my, -1]]) {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = q > 0 ? COLORS.pos : COLORS.neg; ctx.fill();
      ctx.strokeStyle = '#0b0f18'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#0b0f18'; ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(q > 0 ? '+' : '−', x, y + 1);
    }
    // torque (curved arrow, size ∝ |τ|)
    if (show.torque) {
      const tmax = 5 * nC * DIPOLE_D * 1e5;
      const frac = Math.min(1, Math.abs(fz.torque) / tmax);
      if (frac > 0.01) {
        const r = L * 0.25;
        const sweep = 0.4 + 2.2 * frac;
        const ccw = fz.torque > 0;
        const a0 = ccw ? 0.6 : -0.6;
        ctx.strokeStyle = COLORS.push; ctx.lineWidth = 3.5;
        ctx.beginPath();
        // canvas angles run clockwise; counter-clockwise torque sweeps negative canvas angle
        const start = -a0;
        const end = ccw ? start - sweep : start + sweep;
        ctx.arc(cx, cy, r, start, end, ccw);
        ctx.stroke();
        const ex = cx + r * Math.cos(end);
        const ey = cy + r * Math.sin(end);
        const tx = ccw ? Math.sin(end) : -Math.sin(end);
        const ty = ccw ? -Math.cos(end) : Math.cos(end);
        arrow(ctx, ex - tx * 2, ey - ty * 2, ex + tx * 8, ey + ty * 8, { color: COLORS.push, width: 3.5, head: 10 });
        label(ctx, 'torque', cx, cy + r + 16, { size: 12, color: COLORS.push });
      }
    }
    return fz;
  }
}

function mountDipole(container, life) {
  linkSymbols(container, life);
  const { sim, ctrl } = viewBody(container,
    'A rigid dipole: +q and −q joined by a rod. In a uniform field the two forces are equal and opposite, so the net force is zero. But they act at different points, so they twist the dipole toward the field. Drag the dipole to set its angle, then let go.');
  const s = { q: 2 * nC, E: 5e4, theta: (150 * Math.PI) / 180, omega: 0, zeta: 0.12, playing: true, show: { forces: true, torque: true, p: true } };
  const panel = h('div', { class: 'circuit-view field-panel' });
  sim.appendChild(panel);
  const stage = new Stage(panel, life, { aspect: 0.6, minHeight: 260, maxHeight: 420, label: 'Dipole in a uniform electric field' });
  stage.canvas.classList.add('draggable');
  panel.appendChild(h('div', { class: 'panel-note' }, h('span', {}, 'The motion is slowed so you can watch it.'),
    infoNote('The dipole’s rotational inertia is chosen so one swing takes about 2.5 s at the default settings. The forces, torque and energy are computed from the real charges and field.', { label: 'About the motion' })));
  const dc = new DipoleCanvas(stage, s);
  const ro = readouts([
    { key: 'theta', label: 'Angle θ', format: (v) => `${formatNum(v, 3)}°`, sym: 'theta' },
    { key: 'net', label: 'Net force', unit: 'N' },
    { key: 'tau', label: 'Torque τ = pE sin θ', unit: 'N·m', sym: 'tau' },
    { key: 'U', label: 'U = −pE cos θ', unit: 'J', sym: 'U' },
  ]);
  const uFill = h('span', { class: 'eh-fill eh-u' });
  const kFill = h('span', { class: 'eh-fill eh-k' });
  const uVal = h('span', { class: 'pb-val' });
  const kVal = h('span', { class: 'pb-val' });
  const bar = h('div', { class: 'energy-h' },
    h('div', { class: 'pb-row' }, h('span', { class: 'pb-label' }, 'Potential U'), h('span', { class: 'eh-track eh-diverge' }, h('span', { class: 'eh-mid' }), uFill), uVal),
    h('div', { class: 'pb-row' }, h('span', { class: 'pb-label' }, 'Kinetic K'), h('span', { class: 'eh-track' }, kFill), kVal),
    h('p', { class: 'small muted pb-note' }, 'U runs from −pE (lined up) to +pE (pointing against the field). Without damping, U + K stays constant.'));
  const why = h('div', { class: 'why-note' });
  const sE = slider({ label: 'Field <i>E</i>', sym: 'E', min: 1e4, max: 1e5, step: 5e3, value: s.E, unit: 'N/C', onInput: (v) => { s.E = v; } });
  const sQ = slider({ label: 'Charge <i>q</i> (p = q × 2.00 cm)', sym: 'q', min: 1, max: 5, step: 0.5, value: s.q / nC, format: (v) => `${formatNum(v, 2)} nC`, onInput: (v) => { s.q = v * nC; } });
  const sZ = slider({ label: 'Damping', min: 0, max: 1, step: 0.05, value: s.zeta, format: (v) => (v === 0 ? 'none' : formatNum(v, 2)), onInput: (v) => { s.zeta = v; } });
  const releaseBtn = h('button', { type: 'button', class: 'btn btn-primary dipole-release' }, 'Release from 150°');
  releaseBtn.addEventListener('click', () => { s.theta = (150 * Math.PI) / 180; s.omega = 0; s.playing = true; });
  const eq = equationReveal('<span class="sym" data-sym="tau">τ</span> = <i>pE</i> sin <span class="sym" data-sym="theta">θ</span>, &nbsp; <span class="sym" data-sym="U"><i>U</i></span> = −<i>pE</i> cos <span class="sym" data-sym="theta">θ</span>, &nbsp; <i>p</i> = <span class="sym" data-sym="q"><i>q</i></span><i>d</i>');
  const changeCard = ctrlCard(ctrl, 'Change it', releaseBtn, sE.el, sQ.el, sZ.el);
  const measure = h('section', { class: 'ctrl-card' }, h('h3', {}, 'What the sim measures'), ro.el,
    bar, why, eq.el);
  sim.appendChild(measure);
  void changeCard;

  let dragging = false;
  const setFromPointer = (ev) => {
    const { x, y } = stage.local(ev);
    s.theta = Math.atan2(stage.h / 2 - y, x - stage.w / 2);
    s.omega = 0;
  };
  life.on(stage.canvas, 'pointerdown', (ev) => { dragging = true; stage.canvas.setPointerCapture(ev.pointerId); setFromPointer(ev); });
  life.on(stage.canvas, 'pointermove', (ev) => { if (dragging) setFromPointer(ev); });
  const up = () => { dragging = false; s.playing = true; };
  life.on(stage.canvas, 'pointerup', up);
  life.on(stage.canvas, 'pointercancel', up);
  life.on(stage.canvas, 'touchstart', (ev) => {
    const t = ev.touches[0];
    if (!t) return;
    const { x, y } = stage.local(t);
    if (Math.hypot(x - stage.w / 2, y - stage.h / 2) < Math.min(stage.w, stage.h) * 0.36) ev.preventDefault();
  }, { passive: false });

  life.frame((dt) => {
    const p = s.q * DIPOLE_D;
    if (!dragging && s.playing) {
      const b = 2 * s.zeta * Math.sqrt(p * s.E * INERTIA);
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      let st = { theta: s.theta, omega: s.omega };
      for (let i = 0; i < n; i++) st = stepDipole(st, { p, E: s.E, I: INERTIA, b }, dt / n);
      s.theta = st.theta; s.omega = st.omega;
    }
    const fz = stage.visible ? dc.draw() : dipoleForces(s.q, DIPOLE_D, s.E, s.theta);
    const thDeg = (wrapAngle(s.theta) * 180) / Math.PI;
    const U = dipoleEnergy(p, s.E, s.theta);
    const Kin = 0.5 * INERTIA * s.omega * s.omega;
    ro.set('theta', Math.abs(thDeg));
    ro.set('net', Math.hypot(fz.net.x, fz.net.y));
    ro.set('tau', Math.abs(fz.torque));
    ro.set('U', U);
    const pE = p * s.E;
    const uf = Math.max(-1, Math.min(1, U / pE));
    uFill.style.left = `${50 + Math.min(0, uf) * 50}%`;
    uFill.style.width = `${Math.abs(uf) * 50}%`;
    kFill.style.width = `${Math.max(0, Math.min(1, Kin / (2 * pE))) * 100}%`;
    uVal.textContent = f(U, 'J');
    kVal.textContent = f(Kin, 'J');
    const aligned = Math.abs(thDeg) < 2 && Math.abs(s.omega) < 0.05;
    const text = aligned
      ? 'Lined up with the field: the forces act along the same line, so the torque is zero and U = −pE is as low as it gets. This is a stable equilibrium.'
      : `The forces +qE and −qE cancel (net force 0), but they push at opposite ends, so they twist the dipole toward the field. Torque is biggest at 90° (sin θ = 1). As it turns, U falls and the lost U becomes motion${s.zeta > 0 ? ', which the damping then drains away' : ''}.`;
    if (why.innerHTML !== text) why.innerHTML = text;
  });
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------
function mountSolve(container, life) {
  container.appendChild(h('p', { class: 'view-intro', html: 'Two problems on fields. Each step acts on the sim; then try a variation.' }));
  const sel = segmented({
    label: 'Problem', value: 0,
    options: FIELD_PROBLEMS.map((p, i) => ({ value: i, label: `${i + 1}. ${['Superposition', 'Dipole torque'][i]}` })),
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
    const ctx = makeFieldSolveCtx(sim, inner);
    solveRunner(ctrl, inner, FIELD_PROBLEMS[i], ctx, { index: i });
    inner.frame((dt) => ctx.frame(dt));
  }
  show(0);
}

function makeFieldSolveCtx(sim, life) {
  const holder = h('div', { class: 'sim-col' });
  sim.appendChild(holder);
  let viewLife = null;
  let kind = null;
  let fc = null;
  let dc = null;
  let stage = null;
  let s = null;
  return {
    load(k, p) {
      kind = k;
      if (viewLife) viewLife.destroy();
      holder.replaceChildren();
      viewLife = life.child();
      const panel = h('div', { class: 'circuit-view field-panel' });
      holder.appendChild(panel);
      stage = new Stage(panel, viewLife, { aspect: 0.66, minHeight: 260, maxHeight: 420, label: k === 'superposition' ? 'Two charges and a probe point P' : 'Dipole in a uniform field' });
      fc = null; dc = null;
      if (k === 'superposition') {
        const width = Math.max(0.12, 2 * p.a + 0.05);
        s = { charges: [{ x: -p.a, y: 0, q: p.q1 }, { x: p.a, y: 0, q: p.q2 }], probe: { x: 0, y: p.y }, lines: false, guides: false, width, center: [0, p.y / 2] };
        fc = new FieldCanvas(stage, s);
        fc.show = { grid: true, parts: false, sum: false, distance: false, components: false };
        panel.appendChild(h('div', { class: 'panel-note' }, 'The probe marks the point P.'));
      } else {
        s = { q: p.q, E: p.E, theta: (p.theta * Math.PI) / 180, omega: 0, zeta: 0.15, playing: false, show: { p: false, forces: false, torque: false } };
        dc = new DipoleCanvas(stage, s);
      }
    },
    show(what) {
      if (fc) {
        if (what === 'distance') fc.show.distance = true;
        if (what === 'parts') { fc.show.parts = true; fc.show.distance = false; }
        if (what === 'sum') { fc.show.parts = true; fc.show.sum = true; fc.show.components = true; }
        fc.dirty = true;
      } else if (dc) {
        if (what === 'p') s.show.p = true;
        if (what === 'forces') s.show.forces = true;
        if (what === 'torque') s.show.torque = true;
        if (what === 'release') { s.show = { p: true, forces: true, torque: true }; s.playing = true; }
      }
    },
    frame(dt) {
      if (!stage || !stage.visible) return;
      if (fc) { fc.draw(); return; }
      if (dc) {
        const pm = s.q * DIPOLE_D;
        if (s.playing) {
          const b = 2 * s.zeta * Math.sqrt(pm * s.E * INERTIA);
          const n = Math.max(1, Math.ceil(dt / (1 / 240)));
          let st = { theta: s.theta, omega: s.omega };
          for (let i = 0; i < n; i++) st = stepDipole(st, { p: pm, E: s.E, I: INERTIA, b }, dt / n);
          s.theta = st.theta; s.omega = st.omega;
        }
        dc.draw();
      }
      void kind;
    },
  };
}
