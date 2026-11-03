// Live plot traced from simulated values, with a faded ghost of the previous run and τ markers.
import { h } from './dom.js';
import { Stage } from './stage.js';
import { COLORS } from './colors.js';
import { formatSI } from '../core/format.js';
import { label } from './schematic.js';

function niceStep(range, target = 4) {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const n = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return n * p;
}

export class LivePlot {
  /**
   * @param o.title   plot title, e.g. "q(t)"
   * @param o.unit    y unit, e.g. "C"
   * @param o.color   trace colour
   */
  constructor(parent, life, { title, unit, color = COLORS.trace, xUnit = 's', aspect = 0.5, minHeight = 130, maxHeight = 210, sym } = {}) {
    this.title = title;
    this.unit = unit;
    this.xUnit = xUnit;
    this.color = color;
    this.data = [];
    this.ghost = null;
    this.markers = [];
    this.tMax = 1;
    this.yMin = 0;
    this.yMax = 1;
    this.el = h('figure', { class: 'plot', data: sym ? { sym } : {} },
      h('figcaption', { class: 'plot-title', html: title }));
    parent.appendChild(this.el);
    this.stage = new Stage(this.el, life, { aspect, minHeight, maxHeight, label: `Graph of ${String(title).replace(/<[^>]+>/g, '')}` });
    this.stage.onResize = () => { this.dirty = true; };
    this.dirty = true;
  }

  setAxes({ tMax, yMin = 0, yMax }) {
    if (Number.isFinite(tMax) && tMax > 0) this.tMax = tMax;
    if (Number.isFinite(yMin)) this.yMin = yMin;
    if (Number.isFinite(yMax) && yMax !== this.yMin) this.yMax = yMax;
    this.dirty = true;
  }

  /** Start a new run. The previous trace becomes the ghost (if keepGhost). */
  reset({ keepGhost = true } = {}) {
    if (keepGhost && this.data.length > 2) this.ghost = this.data;
    else if (!keepGhost) this.ghost = null;
    this.data = [];
    this.dirty = true;
  }

  push(t, y) {
    if (!Number.isFinite(t) || !Number.isFinite(y)) return;
    const last = this.data[this.data.length - 1];
    if (last && t - last[0] < this.tMax / 600 && this.data.length > 1) {
      // Thin the samples so long runs stay cheap to draw
      return;
    }
    this.data.push([t, y]);
    this.dirty = true;
  }

  /** markers: [{ type: 'v' | 'h', at, label, color }] */
  setMarkers(markers) { this.markers = markers || []; this.dirty = true; }

  draw(force = false) {
    if (!this.stage.visible || (!this.dirty && !force && !this.stage.dirty)) return;
    this.dirty = false;
    this.stage.dirty = false;
    const ctx = this.stage.begin(COLORS.panel);
    const W = this.stage.w;
    const H = this.stage.h;
    const L = 52; const R = 12; const T = 12; const B = 26;
    const pw = W - L - R;
    const ph = H - T - B;
    const X = (t) => L + (t / this.tMax) * pw;
    const Y = (v) => T + (1 - (v - this.yMin) / (this.yMax - this.yMin)) * ph;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    // Grid and ticks
    const ys = niceStep(this.yMax - this.yMin, ph < 120 ? 3 : 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = Math.ceil(this.yMin / ys) * ys; v <= this.yMax + ys * 1e-6; v += ys) {
      const yy = Y(v);
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
      ctx.fillText(formatSI(Math.abs(v) < ys * 1e-6 ? 0 : v, this.unit, { sig: 2 }), L - 6, yy);
    }
    const xs = niceStep(this.tMax, pw < 260 ? 3 : 5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= this.tMax + xs * 1e-6; t += xs) {
      const xx = X(t);
      ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke();
      ctx.fillText(formatSI(t, this.xUnit, { sig: 2 }), xx, T + ph + 6);
    }
    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(W - R, T + ph); ctx.stroke();

    // Markers
    for (const m of this.markers) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = m.color || 'rgba(240,228,66,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (m.type === 'v') { const xx = X(m.at); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); } else { const yy = Y(m.at); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); }
      ctx.stroke();
      ctx.restore();
      if (m.label) {
        if (m.type === 'v') label(ctx, m.label, Math.min(W - R - 30, X(m.at) + 4), T + 10, { size: 12, align: 'left', color: m.color || '#f0e442' });
        else label(ctx, m.label, W - R - 2, Y(m.at) - 11, { size: 12, align: 'right', color: m.color || '#f0e442' });
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T - 2, pw + 2, ph + 4);
    ctx.clip();
    if (this.ghost) this.trace(ctx, this.ghost, X, Y, COLORS.ghost, 2, [6, 5]);
    this.trace(ctx, this.data, X, Y, this.color, 3, []);
    ctx.restore();
    if (this.ghost) {
      label(ctx, 'dashed: previous run', L + 6, T + ph - 12, { size: 11, align: 'left', color: COLORS.muted });
    }
  }

  trace(ctx, data, X, Y, color, width, dash) {
    if (!data || data.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(X(data[0][0]), Y(data[0][1]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(data[i][0]), Y(data[i][1]));
    ctx.stroke();
    ctx.restore();
  }
}
