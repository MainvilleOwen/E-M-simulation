// Height map: the loop unrolled left to right as a potential profile. Battery = lift, wire = flat,
// resistor = downhill ramp (drop IR), capacitor = step of height q/C. The same dots ride along it.
//
// Pieces arrive already mapped to px: { id, xa, xb, f0, f1, dotStyle, side }
//   xa / xb  x of the track's start (terminal a) and end (terminal b)
//   f0 / f1  fractions along the track where the symbol body starts and ends (leads are flat)
//   side     true when x comes from the schematic (side view): dots then use their true x
import { colorForV, COLORS, rgba } from './colors.js';
import { drawDot } from './dots.js';
import { arrow, label } from './schematic.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function pieceInfo(layout, id) {
  const el = layout.elements && layout.elements[id];
  if (el) return { kind: el.kind, na: el.na, nb: el.nb, el };
  const w = (layout.wires || []).find((x) => x.id === id);
  if (w) return { kind: 'wire', na: w.node, nb: w.node, wire: w };
  return null;
}

/** Potential at fraction f (0..1 along the track from terminal a to b). */
export function potentialAlong(sol, info, f, f0 = 0, f1 = 1) {
  const va = sol && sol.V ? sol.V[info.na] || 0 : 0;
  const vb = sol && sol.V ? sol.V[info.nb] || 0 : 0;
  if (info.kind === 'wire') return va;
  if (info.kind === 'capacitor' || info.kind === 'switch') return f < 0.5 ? va : vb;
  if (f <= f0) return va;
  if (f >= f1) return vb;
  return va + ((vb - va) * (f - f0)) / (f1 - f0 || 1);
}

const xOf = (p, f) => p.xa + (p.xb - p.xa) * f;

/**
 * @param o.pieces       mapped pieces (see top of file)
 * @param o.vMin, o.vMax potential range (shared across a screen)
 * @param o.dots         DotSystem (dots drawn on pieces whose id is a track)
 * @param o.annotations  [{ x, v0, v1, label, color }]
 * @param o.marker       { x, v } in px / volts
 * @param o.labels       { id: short label under the piece }
 * @param o.levels       [{ v, text }] dashed guide lines
 */
export function drawHeightMap(ctx, W, H, layout, sol, o = {}) {
  const { vMin = 0, vMax = 1, pieces = [] } = o;
  const top = o.padTop != null ? o.padTop : 16;
  const bottom = o.padBottom != null ? o.padBottom : 24;
  const span = vMax - vMin || 1;
  const y = (V) => top + ((vMax - V) / span) * (H - top - bottom);
  const base = y(vMin);
  const fs = clamp(W / 32, 12, 14);
  const alphaOf = (id) => (o.alpha && o.alpha[id] != null ? o.alpha[id] : 1);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Guide lines
  const levels = o.levels || [{ v: vMin, text: fmtV(vMin) }, { v: vMax, text: fmtV(vMax) }];
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (const lv of levels) {
    ctx.beginPath();
    ctx.moveTo(0, y(lv.v));
    ctx.lineTo(W, y(lv.v));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const items = pieces.map((p) => ({ p, info: pieceInfo(layout, p.id) })).filter((x) => x.info);
  const V = (it, f) => potentialAlong(sol, it.info, f, it.p.f0, it.p.f1);

  // Soft fill under the profile (reads as "height")
  ctx.fillStyle = 'rgba(120,170,230,0.07)';
  for (const it of items) {
    const { p, info } = it;
    if (info.kind === 'battery' || info.kind === 'capacitor' || info.kind === 'switch' || p.dotStyle === 'ring') continue;
    if (alphaOf(p.id) <= 0.01) continue;
    const fs4 = info.kind === 'wire' ? [0, 1] : [0, p.f0, p.f1, 1];
    ctx.beginPath();
    ctx.moveTo(xOf(p, 0), base);
    for (const f of fs4) ctx.lineTo(xOf(p, f), y(V(it, f)));
    ctx.lineTo(xOf(p, 1), base);
    ctx.closePath();
    ctx.fill();
  }

  // Profile
  for (const it of items) {
    const { p, info } = it;
    const a = alphaOf(p.id);
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    const va = V(it, 0);
    const vb = V(it, 1);
    const ca = colorForV(va, vMin, vMax);
    const cb = colorForV(vb, vMin, vMax);
    if (o.highlight && o.highlight.has(p.id)) {
      ctx.strokeStyle = rgba(COLORS.highlight, 0.45);
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(xOf(p, 0), y(va));
      if (info.kind !== 'wire') { ctx.lineTo(xOf(p, p.f0), y(va)); ctx.lineTo(xOf(p, p.f1), y(vb)); }
      ctx.lineTo(xOf(p, 1), y(vb));
      ctx.stroke();
    }
    if (info.kind === 'wire') {
      if (p.span) flat(ctx, p.span[0], p.span[1], y(va), ca);
      else flat(ctx, xOf(p, 0), xOf(p, 1), y(va), ca);
      ctx.globalAlpha = 1;
      continue;
    }
    // Leads are flat at the terminal potentials
    flat(ctx, xOf(p, 0), xOf(p, p.f0), y(va), ca);
    flat(ctx, xOf(p, p.f1), xOf(p, 1), y(vb), cb);
    const x0 = xOf(p, p.f0);
    const x1 = xOf(p, p.f1);
    if (info.kind === 'battery') {
      drawLift(ctx, x0, x1, y(va), y(vb), ca, cb);
    } else if (info.kind === 'capacitor') {
      drawStep(ctx, (x0 + x1) / 2, y(va), y(vb), ca, cb);
    } else if (info.kind === 'switch') {
      const closed = info.el && info.el.ref && info.el.ref.closed;
      if (closed) flat(ctx, x0, x1, y(va), ca);
    } else if (info.kind === 'resistor' || info.kind === 'bulb') {
      const grad = ctx.createLinearGradient(x0, y(va), x1 + 0.01, y(vb) + 0.01);
      grad.addColorStop(0, ca);
      grad.addColorStop(1, cb);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0, y(va));
      ctx.lineTo(x1, y(vb));
      ctx.stroke();
      if (Math.abs(y(va) - y(vb)) > 6 && Math.abs(x1 - x0) > 12) {
        // hatch marks under a ramp so it reads as a slope
        ctx.strokeStyle = rgba('#c8d0e0', 0.25);
        ctx.lineWidth = 1;
        const n = Math.max(2, Math.floor(Math.abs(x1 - x0) / 9));
        for (let i = 1; i < n; i++) {
          const f = i / n;
          const xx = x0 + (x1 - x0) * f;
          const yy = y(va) + (y(vb) - y(va)) * f;
          ctx.beginPath();
          ctx.moveTo(xx, yy + 4);
          ctx.lineTo(xx - 5, yy + 10);
          ctx.stroke();
        }
      }
    } else {
      flat(ctx, x0, x1, y(va), ca);
    }
    ctx.globalAlpha = 1;
  }

  // Dots riding the profile
  if (o.dots) {
    const r = clamp(W / 110, 3, 4.5);
    for (const it of items) {
      const { p, info } = it;
      if (info.kind === 'capacitor') continue;
      const a = alphaOf(p.id);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      o.dots.eachDot(p.id, (f, pt) => {
        const xx = p.side && o.xOfPoint ? o.xOfPoint(pt) : xOf(p, f);
        drawDot(ctx, xx, y(V(it, f)), r, p.dotStyle);
      });
    }
    ctx.globalAlpha = 1;
  }

  // Piece labels along the bottom
  if (o.labels) {
    for (const { p } of items) {
      const t = o.labels[p.id];
      if (!t) continue;
      const a = alphaOf(p.id);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      label(ctx, t, (xOf(p, p.f0 || 0) + xOf(p, p.f1 == null ? 1 : p.f1)) / 2, H - bottom / 2, { size: fs - 1, bg: null, color: COLORS.muted });
    }
    ctx.globalAlpha = 1;
  }

  // Level labels (drawn last so they sit above the profile)
  for (const lv of levels) {
    if (!lv.text) continue;
    label(ctx, lv.text, lv.x != null ? lv.x : 4, y(lv.v), { size: fs - 1, align: lv.align || 'left', color: COLORS.muted });
  }

  // Annotations (vertical double arrows, e.g. the net push ε − q/C)
  for (const an of o.annotations || []) {
    const y0 = y(an.v0);
    const y1 = y(an.v1);
    const c = an.color || COLORS.push;
    if (Math.abs(y1 - y0) > 4) {
      arrow(ctx, an.x, (y0 + y1) / 2, an.x, y0, { color: c, width: 3, head: 8 });
      arrow(ctx, an.x, (y0 + y1) / 2, an.x, y1, { color: c, width: 3, head: 8 });
    }
    if (an.label) {
      label(ctx, an.label, an.x + (an.labelDx != null ? an.labelDx : 8), an.labelY != null ? an.labelY : (y0 + y1) / 2,
        { size: fs, align: an.align || 'left', color: c });
    }
  }

  // Marker (loop walk)
  if (o.marker) {
    const mx = o.marker.x;
    const my = y(o.marker.v);
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0e442';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f0e442';
    ctx.fill();
  }
  ctx.restore();
  return { y };
}

function fmtV(v) {
  const r = Math.round(v * 100) / 100;
  return `${r} V`;
}

function flat(ctx, x0, x1, yy, c) {
  if (Math.abs(x1 - x0) < 0.5) return;
  ctx.strokeStyle = c;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x0, yy);
  ctx.lineTo(x1, yy);
  ctx.stroke();
}

function drawLift(ctx, x0, x1, y0, y1, c0, c1) {
  const grad = ctx.createLinearGradient(0, y0, 0.01, y1 + 0.01);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  const half = 5;
  // A ladder: the battery lifts charge up by ε
  ctx.beginPath();
  ctx.moveTo(x0 - half, y0);
  ctx.lineTo(x1 - half, y1);
  ctx.moveTo(x0 + half, y0);
  ctx.lineTo(x1 + half, y1);
  ctx.stroke();
  const n = Math.max(2, Math.floor(Math.abs(y1 - y0) / 9));
  ctx.lineWidth = 2;
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const xx = x0 + (x1 - x0) * f;
    const yy = y0 + (y1 - y0) * f;
    ctx.beginPath();
    ctx.moveTo(xx - half, yy);
    ctx.lineTo(xx + half, yy);
    ctx.stroke();
  }
}

function drawStep(ctx, x, y0, y1, c0, c1) {
  // Two plates at their own heights, joined by a dashed riser: charge cannot cross the gap.
  ctx.lineWidth = 4;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = c0;
  ctx.beginPath();
  ctx.moveTo(x - 9, y0);
  ctx.lineTo(x + 9, y0);
  ctx.stroke();
  ctx.strokeStyle = c1;
  ctx.beginPath();
  ctx.moveTo(x - 9, y1);
  ctx.lineTo(x + 9, y1);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba('#c8d0e0', 0.6);
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.setLineDash([]);
}
