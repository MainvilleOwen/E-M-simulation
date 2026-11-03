// Canvas stage: devicePixelRatio-aware, redraws on resize, knows when it is on screen,
// and can show a calm "Can't compute this setup" banner.
import { h } from './dom.js';

export class Stage {
  /**
   * @param parent  element to append to
   * @param life    Lifecycle
   * @param opts.aspect      height / width
   * @param opts.minHeight   px
   * @param opts.maxHeight   px
   * @param opts.label       accessible label describing the canvas
   */
  constructor(parent, life, { aspect = 0.6, minHeight = 160, maxHeight = 520, label = 'Simulation', className = '' } = {}) {
    this.aspect = aspect;
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;
    this.canvas = h('canvas', { role: 'img', 'aria-label': label });
    this.problem = h('div', { class: 'stage-problem', hidden: true, role: 'status' });
    this.el = h('div', { class: `stage ${className}`.trim() }, this.canvas, this.problem);
    parent.appendChild(this.el);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this._visible = true;
    this.dirty = true;
    this.onResize = null;
    life.resize(this.el, () => this.resize());
    life.visible(this.el, (v) => { this._visible = v; if (v) this.dirty = true; });
    this.resize();
  }

  /** On screen? (Tests can set window.__emlabAlwaysDraw for full-page screenshots.) */
  get visible() {
    return this._visible || (typeof window !== 'undefined' && !!window.__emlabAlwaysDraw);
  }

  resize() {
    const w = Math.max(1, Math.round(this.el.clientWidth || this.el.getBoundingClientRect().width || 300));
    let hgt = Math.round(w * this.aspect);
    hgt = Math.max(this.minHeight, Math.min(this.maxHeight, hgt));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (w === this.w && hgt === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = hgt;
    this.dpr = dpr;
    this.canvas.style.height = `${hgt}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.dirty = true;
    if (this.onResize) this.onResize(w, hgt);
  }

  /** Begin a frame: resets the transform for DPR and clears. Returns the 2D context. */
  begin(bg = '#121826') {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);
    return ctx;
  }

  /** Pointer position in CSS px relative to the canvas. */
  local(ev) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  showProblem(msg = "Can't compute this setup.") {
    this.problem.textContent = msg;
    this.problem.hidden = false;
  }

  clearProblem() {
    if (!this.problem.hidden) this.problem.hidden = true;
  }
}

/** Fit a layout box (w × h logical units) into W × H px with padding, preserving aspect. */
export function fitTransform(layoutW, layoutH, W, H, pad = 16) {
  const scale = Math.max(0.01, Math.min((W - 2 * pad) / layoutW, (H - 2 * pad) / layoutH));
  const ox = (W - layoutW * scale) / 2;
  const oy = (H - layoutH * scale) / 2;
  return {
    scale, ox, oy,
    x: (x) => ox + x * scale,
    y: (y) => oy + y * scale,
    p: (pt) => [ox + pt[0] * scale, oy + pt[1] * scale],
  };
}
