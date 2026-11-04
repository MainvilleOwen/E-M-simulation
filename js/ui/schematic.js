// Schematic renderer: wires tinted by potential, element symbols, push arrows, bulbs, plate charges.
// Layout coordinates are logical units; T (from fitTransform) maps them to canvas px.
import { colorForV, COLORS, rgba } from './colors.js';
import { drawDot } from './dots.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Potential at an element terminal or wire. */
function vOf(sol, node) {
  if (!sol || !sol.V) return 0;
  const v = sol.V[node];
  return Number.isFinite(v) ? v : 0;
}

function geom(T, el) {
  const A = T.p(el.a);
  const B = T.p(el.b);
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const L = Math.hypot(dx, dy) || 1;
  const u = [dx / L, dy / L];
  const n = [u[1], -u[0]];
  const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  return { A, B, L, u, n, M };
}

function line(ctx, p0, p1) {
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.stroke();
}

export function arrow(ctx, x0, y0, x1, y1, { color = COLORS.push, width = 4, head = 10 } = {}) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  if (L < 1) return;
  const ux = dx / L;
  const uy = dy / L;
  const hd = Math.min(head, L * 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * hd * 0.8, y1 - uy * hd * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hd - uy * hd * 0.6, y1 - uy * hd + ux * hd * 0.6);
  ctx.lineTo(x1 - ux * hd + uy * hd * 0.6, y1 - uy * hd - ux * hd * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text with a dark backdrop for legibility on the panel. Lines may be strings. */
export function label(ctx, lines, x, y, { size = 14, align = 'center', color = COLORS.ink, bg = 'rgba(18,24,38,0.82)', bold = false } = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  if (!arr.length) return;
  ctx.save();
  ctx.font = `${bold ? '600 ' : ''}${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  const lh = size * 1.25;
  const widths = arr.map((s) => ctx.measureText(s).width);
  const w = Math.max(...widths) + 10;
  const hgt = lh * arr.length + 4;
  let left = x - w / 2;
  if (align === 'left') left = x;
  if (align === 'right') left = x - w;
  const top = y - hgt / 2;
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, left, top, w, hgt, 5);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  arr.forEach((s, i) => ctx.fillText(s, left + w / 2, top + 2 + lh * (i + 0.5)));
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

/**
 * Draw a schematic.
 * @param o.vMin, o.vMax  potential range for the tint (shared across a screen)
 * @param o.pushPerVolt   px per volt for push arrows (null = no arrows)
 * @param o.labels        { id: string | string[] }
 * @param o.highlight     Set of element/wire ids to highlight
 * @param o.alpha         { id: 0..1 } fade individual parts
 * @param o.pRef          bulb power for full brightness
 * @param o.qPerMark      capacitor charge per drawn +/− mark
 * @param o.dots          DotSystem
 * @param o.marker        [x, y] layout position of the loop-walk marker
 * @param o.assumed       [{ at:[x,y], dir:[dx,dy], label }] assumed current directions
 */
export function drawSchematic(ctx, T, layout, sol, o = {}) {
  const { vMin = 0, vMax = 1 } = o;
  const unit = T.scale;
  const ww = clamp(unit * 0.9, 3, 6);
  const fs = clamp(unit * 2.4, 12, 15);
  const alphaOf = (id) => (o.alpha && o.alpha[id] != null ? o.alpha[id] : 1);
  const col = (V, a = 1) => colorForV(V, vMin, vMax, a);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Highlights (behind everything)
  if (o.highlight && o.highlight.size) {
    ctx.save();
    ctx.strokeStyle = rgba(COLORS.highlight, 0.5);
    ctx.lineWidth = ww + 14;
    for (const w of layout.wires || []) {
      if (!o.highlight.has(w.id)) continue;
      tracePath(ctx, w.pts.map(T.p));
      ctx.stroke();
    }
    for (const [id, el] of Object.entries(layout.elements || {})) {
      if (!o.highlight.has(id)) continue;
      const g = geom(T, el);
      ctx.globalAlpha = alphaOf(id);
      line(ctx, g.A, g.B);
      ctx.beginPath();
      ctx.arc(g.M[0], g.M[1], clamp(unit * 6, 16, 30), 0, Math.PI * 2);
      ctx.fillStyle = rgba(COLORS.highlight, 0.22);
      ctx.fill();
    }
    ctx.restore();
  }

  // Wires
  for (const w of layout.wires || []) {
    const a = alphaOf(w.id);
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    ctx.strokeStyle = col(vOf(sol, w.node));
    ctx.lineWidth = ww;
    tracePath(ctx, w.pts.map(T.p));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Elements
  for (const [id, el] of Object.entries(layout.elements || {})) {
    const a = alphaOf(id);
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    const g = geom(T, el);
    const va = vOf(sol, el.na);
    const vb = vOf(sol, el.nb);
    ctx.lineWidth = ww;
    switch (el.kind) {
      case 'resistor': drawResistor(ctx, g, unit, ww, col(va), col(vb)); break;
      case 'bulb': drawBulb(ctx, g, unit, ww, col(va), col(vb), sol && sol.P ? sol.P[id] : 0, o.pRef || 1); break;
      case 'battery': drawBattery(ctx, g, unit, ww, col(va), col(vb), fs); break;
      case 'capacitor': drawCapacitor(ctx, g, unit, ww, col(va), col(vb), sol && sol.q ? sol.q[id] || 0 : 0, o.qPerMark || Infinity, o.maxMarks || 12, el.plateScale || 1); break;
      case 'switch': drawSwitch(ctx, g, unit, ww, col(va), col(vb), !!(el.ref && el.ref.closed)); break;
      case 'wire': ctx.strokeStyle = col(va); line(ctx, g.A, g.B); break;
      default: break;
    }
  }
  ctx.globalAlpha = 1;

  // Junction dots
  for (const j of layout.junctions || []) {
    const a = j.id ? alphaOf(j.id) : 1;
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    const [x, y] = T.p(j.at || j);
    ctx.beginPath();
    ctx.arc(x, y, ww * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = col(vOf(sol, j.node));
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Push arrows (sized by the voltage drop)
  if (o.pushPerVolt && sol && sol.V) {
    for (const [id, el] of Object.entries(layout.elements || {})) {
      if (el.kind !== 'resistor' && el.kind !== 'bulb') continue;
      if (el.noPush) continue;
      const a = alphaOf(id);
      if (a <= 0.01) continue;
      const drop = vOf(sol, el.na) - vOf(sol, el.nb);
      const len = Math.min(Math.abs(drop) * o.pushPerVolt, 400);
      if (len < 3) continue;
      const g = geom(T, el);
      const side = el.pushSide != null ? el.pushSide : -(el.labelSide || 1);
      const off = (el.kind === 'bulb' ? clamp(unit * 7.5, 22, 36) : clamp(unit * 4.2, 13, 22)) * side;
      const cx = g.M[0] + g.n[0] * off;
      const cy = g.M[1] + g.n[1] * off;
      const s = Math.sign(drop);
      ctx.globalAlpha = a;
      arrow(ctx, cx - g.u[0] * s * len / 2, cy - g.u[1] * s * len / 2, cx + g.u[0] * s * len / 2, cy + g.u[1] * s * len / 2,
        { color: COLORS.push, width: clamp(unit * 0.8, 3, 5), head: clamp(unit * 2, 8, 12) });
    }
    ctx.globalAlpha = 1;
  }

  // Dots
  if (o.dots) {
    o.dots.draw(ctx, T, { radius: clamp(unit * 0.85, 3, 5), alpha: o.alpha, styles: o.dotStyles });
  }
  // Charge piled up on capacitor plates (from the solver's q): densest at the plate, thinning along the wire
  if (sol && sol.q && o.qPerMark) {
    for (const [id, el] of Object.entries(layout.elements || {})) {
      if (el.kind !== 'capacitor') continue;
      const a = alphaOf(id);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      drawPile(ctx, T, layout, el, sol.q[id] || 0, o.qPerMark, (o.maxMarks || 12) * 3, clamp(unit * 0.85, 3, 5));
    }
    ctx.globalAlpha = 1;
  }

  // Assumed current directions (Kirchhoff)
  for (const as of o.assumed || []) {
    const [x, y] = T.p(as.at);
    const len = clamp(unit * 6, 18, 32);
    const [dx, dy] = as.dir;
    const c = as.color || '#f0e442';
    arrow(ctx, x - dx * len / 2, y - dy * len / 2, x + dx * len / 2, y + dy * len / 2, { color: c, width: 3, head: 9 });
    if (as.label) {
      const lo = as.labelOffset || [0, -1];
      label(ctx, as.label, x + lo[0] * (len * 0.6 + 8), y + lo[1] * (len * 0.3 + 10), { size: fs, color: c });
    }
  }

  // Labels
  if (o.labels) {
    for (const [id, el] of Object.entries(layout.elements || {})) {
      const text = o.labels[id];
      if (!text) continue;
      const a = alphaOf(id);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      let x; let y; let align = 'center';
      if (el.labelAt) {
        [x, y] = T.p(el.labelAt);
        align = el.labelAlign || 'center';
      } else {
        const g = geom(T, el);
        const side = el.labelSide || 1;
        const lines = Array.isArray(text) ? text.length : 1;
        const off = (el.kind === 'bulb' ? clamp(unit * 7, 22, 34) : clamp(unit * 5.5, 18, 30)) + (lines - 1) * fs * 0.6;
        x = g.M[0] + g.n[0] * off * side;
        y = g.M[1] + g.n[1] * off * side;
      }
      label(ctx, text, x, y, { size: fs, align });
    }
    ctx.globalAlpha = 1;
  }

  // Loop-walk marker
  if (o.marker) {
    const [x, y] = T.p(o.marker);
    ctx.beginPath();
    ctx.arc(x, y, clamp(unit * 2.4, 8, 13), 0, Math.PI * 2);
    ctx.strokeStyle = '#f0e442';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f0e442';
    ctx.fill();
  }
  ctx.restore();
}

/** Half-length (px) of an element's symbol body; the rest of the segment is lead wire. */
export function bodyHalf(kind, L, unit) {
  switch (kind) {
    case 'resistor': return Math.min(L * 0.36, clamp(unit * 7, 16, 40));
    case 'bulb': return Math.min(L * 0.45, clamp(unit * 4.6, 13, 26));
    case 'battery': return clamp(unit * 1.6, 6, 10) / 2;
    case 'capacitor': return clamp(unit * 2.2, 8, 14) / 2;
    case 'switch': return Math.min(L * 0.32, clamp(unit * 5, 12, 26));
    default: return L / 2;
  }
}

function leads(ctx, g, half, ca, cb) {
  const p0 = [g.M[0] - g.u[0] * half, g.M[1] - g.u[1] * half];
  const p1 = [g.M[0] + g.u[0] * half, g.M[1] + g.u[1] * half];
  ctx.strokeStyle = ca;
  line(ctx, g.A, p0);
  ctx.strokeStyle = cb;
  line(ctx, p1, g.B);
  return [p0, p1];
}

function drawResistor(ctx, g, unit, ww, ca, cb) {
  const half = bodyHalf('resistor', g.L, unit);
  const [p0, p1] = leads(ctx, g, half, ca, cb);
  const amp = clamp(unit * 2.2, 6, 11);
  const peaks = 6;
  const grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
  grad.addColorStop(0, ca);
  grad.addColorStop(1, cb);
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2.5, ww * 0.8);
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 0; i < peaks; i++) {
    const f = (i + 0.5) / peaks;
    const s = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(p0[0] + (p1[0] - p0[0]) * f + g.n[0] * amp * s, p0[1] + (p1[1] - p0[1]) * f + g.n[1] * amp * s);
  }
  ctx.lineTo(p1[0], p1[1]);
  ctx.stroke();
}

function drawBulb(ctx, g, unit, ww, ca, cb, P, pRef) {
  const r = bodyHalf('bulb', g.L, unit);
  leads(ctx, g, r, ca, cb);
  const b = clamp((Number.isFinite(P) ? P : 0) / pRef, 0, 1);
  const [cx, cy] = g.M;
  if (b > 0.005) {
    const R = r * (1.2 + 2.4 * b);
    const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, R);
    grd.addColorStop(0, `rgba(255,214,120,${0.85 * b})`);
    grd.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  // Glass colour runs from grey (off) to warm white (full power), linear in power.
  const mix = (a0, a1) => Math.round(a0 + (a1 - a0) * b);
  ctx.fillStyle = `rgb(${mix(70, 255)},${mix(80, 236)},${mix(100, 170)})`;
  ctx.fill();
  ctx.strokeStyle = '#c8d0e0';
  ctx.lineWidth = 2;
  ctx.stroke();
  // filament
  ctx.strokeStyle = b > 0.3 ? '#5a3a00' : '#c8d0e0';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  const fx = r * 0.55;
  ctx.moveTo(cx - g.u[0] * r, cy - g.u[1] * r);
  ctx.lineTo(cx - g.u[0] * fx * 0.6 + g.n[0] * r * 0.25, cy - g.u[1] * fx * 0.6 + g.n[1] * r * 0.25);
  for (let i = 0; i <= 4; i++) {
    const f = -0.6 + (1.2 * i) / 4;
    const s = i % 2 === 0 ? 0.45 : 0.15;
    ctx.lineTo(cx + g.u[0] * fx * f + g.n[0] * r * s, cy + g.u[1] * fx * f + g.n[1] * r * s);
  }
  ctx.lineTo(cx + g.u[0] * r, cy + g.u[1] * r);
  ctx.stroke();
}

function drawBattery(ctx, g, unit, ww, ca, cb, fs) {
  const gap = 2 * bodyHalf('battery', g.L, unit);
  const [p0, p1] = leads(ctx, g, gap / 2, ca, cb);
  const longH = clamp(unit * 4.4, 13, 24);
  const shortH = longH * 0.55;
  ctx.lineCap = 'butt';
  // negative (short, thick) plate at p0
  ctx.strokeStyle = ca;
  ctx.lineWidth = Math.max(4, ww * 1.2);
  line(ctx, [p0[0] - g.n[0] * shortH, p0[1] - g.n[1] * shortH], [p0[0] + g.n[0] * shortH, p0[1] + g.n[1] * shortH]);
  // positive (long, thin) plate at p1
  ctx.strokeStyle = cb;
  ctx.lineWidth = Math.max(2.5, ww * 0.7);
  line(ctx, [p1[0] - g.n[0] * longH, p1[1] - g.n[1] * longH], [p1[0] + g.n[0] * longH, p1[1] + g.n[1] * longH]);
  ctx.lineCap = 'round';
  // signs
  ctx.save();
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const so = longH + fs * 0.5;
  ctx.fillText('+', p1[0] + g.u[0] * fs * 0.55 - g.n[0] * so, p1[1] + g.u[1] * fs * 0.55 - g.n[1] * so);
  ctx.fillText('−', p0[0] - g.u[0] * fs * 0.55 - g.n[0] * so, p0[1] - g.u[1] * fs * 0.55 - g.n[1] * so);
  ctx.restore();
}

function drawCapacitor(ctx, g, unit, ww, ca, cb, q, qPerMark, maxMarks = 12, plateScale = 1) {
  const gap = 2 * bodyHalf('capacitor', g.L, unit);
  const [p0, p1] = leads(ctx, g, gap / 2, ca, cb);
  const ph = clamp(unit * 4.8, 14, 28) * plateScale;
  ctx.lineCap = 'butt';
  ctx.lineWidth = Math.max(4, ww * 1.1);
  ctx.strokeStyle = ca;
  line(ctx, [p0[0] - g.n[0] * ph, p0[1] - g.n[1] * ph], [p0[0] + g.n[0] * ph, p0[1] + g.n[1] * ph]);
  ctx.strokeStyle = cb;
  line(ctx, [p1[0] - g.n[0] * ph, p1[1] - g.n[1] * ph], [p1[0] + g.n[0] * ph, p1[1] + g.n[1] * ph]);
  ctx.lineCap = 'round';
}

function drawSwitch(ctx, g, unit, ww, ca, cb, closed) {
  const half = bodyHalf('switch', g.L, unit);
  const [p0, p1] = leads(ctx, g, half, ca, cb);
  ctx.strokeStyle = ca;
  ctx.lineWidth = Math.max(2.5, ww * 0.8);
  const len = 2 * half;
  const ang = closed ? 0 : -0.5;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dir = [g.u[0] * c - g.n[0] * s, g.u[1] * c - g.n[1] * s];
  const tip = [p0[0] + dir[0] * len, p0[1] + dir[1] * len];
  line(ctx, p0, tip);
  for (const p of [p0, p1]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(3, ww * 0.7), 0, Math.PI * 2);
    ctx.fillStyle = '#e8ecf4';
    ctx.fill();
  }
}

/** Positive charge piled on a capacitor plate: dots on the plate face, then trailing back along its wire. */
function drawPile(ctx, T, layout, el, q, qPerDot, maxPile, r) {
  const n = Math.min(maxPile, Math.round(Math.abs(q) / qPerDot));
  if (!(n > 0)) return;
  const g = geom(T, el);
  const half = bodyHalf('capacitor', g.L, T.scale);
  const posA = q > 0;
  const term = posA ? el.a : el.b;
  const dir = posA ? -1 : 1; // from the plate toward its terminal
  const plate = [g.M[0] + g.u[0] * half * dir, g.M[1] + g.u[1] * half * dir];
  // Path: plate → terminal → along the wire attached there
  const path = [plate, T.p(term)];
  const same = (p) => Math.abs(p[0] - term[0]) < 1e-6 && Math.abs(p[1] - term[1]) < 1e-6;
  for (const w of layout.wires || []) {
    if (same(w.pts[0])) { for (let i = 1; i < w.pts.length; i++) path.push(T.p(w.pts[i])); break; }
    if (same(w.pts[w.pts.length - 1])) { for (let i = w.pts.length - 2; i >= 0; i--) path.push(T.p(w.pts[i])); break; }
  }
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const at = (d) => {
    for (let i = 1; i < path.length; i++) {
      if (d <= cum[i] || i === path.length - 1) {
        const seg = cum[i] - cum[i - 1] || 1;
        const f = Math.min(1, (d - cum[i - 1]) / seg);
        const ux = (path[i][0] - path[i - 1][0]) / seg;
        const uy = (path[i][1] - path[i - 1][1]) / seg;
        return [path[i - 1][0] + ux * seg * f, path[i - 1][1] + uy * seg * f, ux, uy];
      }
    }
    return [...path[path.length - 1], 0, 0];
  };
  const ph = clamp(T.scale * 4.8, 14, 28) * (el.plateScale || 1);
  const onPlate = Math.min(n, Math.max(3, Math.floor((2 * ph) / (2.4 * r))));
  ctx.save();
  // On the plate face
  for (let k = 0; k < onPlate; k++) {
    const f = onPlate === 1 ? 0 : -1 + (2 * k) / (onPlate - 1);
    const x = plate[0] + g.n[0] * f * ph * 0.9 + g.u[0] * dir * (r + 2);
    const y = plate[1] + g.n[1] * f * ph * 0.9 + g.u[1] * dir * (r + 2);
    drawDot(ctx, x, y, r);
  }
  // Along the wire, spacing growing with distance (density falls off away from the plate)
  const rest = n - onPlate;
  const Lmax = Math.min(cum[cum.length - 1], 26 * T.scale);
  for (let k = 0; k < rest; k++) {
    const d = r * 3 + (Lmax - r * 3) * ((k + 1) / rest) ** 1.8;
    const [x, y, ux, uy] = at(d);
    const side = (k % 2 ? 1 : -1) * r * 0.9 * (1 - (k + 1) / (rest + 1));
    drawDot(ctx, x - uy * side, y + ux * side, r);
  }
  ctx.restore();
}
