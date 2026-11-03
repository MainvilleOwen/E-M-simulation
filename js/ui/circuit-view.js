// A linked pair of panels: (a) schematic with tinted wires and dots, (b) height map with the same dots.
import { h, infoNote } from './dom.js';
import { Stage, fitTransform } from './stage.js';
import { DotSystem } from './dots.js';
import { drawSchematic, bodyHalf } from './schematic.js';
import { drawHeightMap } from './heightmap.js';
import { potentialGradientCSS, COLORS } from './colors.js';
import { formatSI } from '../core/format.js';
export { bindLayout } from '../content/layouts.js';

/** Potential legend (DOM). */
export function potentialLegend(vMin, vMax, { note = true } = {}) {
  const lo = h('span', { class: 'legend-lo' }, formatSI(vMin, 'V'));
  const hi = h('span', { class: 'legend-hi' }, formatSI(vMax, 'V'));
  const el = h('div', { class: 'legend', role: 'group', 'aria-label': 'Potential colour legend' },
    h('span', { class: 'legend-title' }, 'Potential'),
    lo,
    h('span', { class: 'legend-bar', style: { background: potentialGradientCSS() }, 'aria-hidden': 'true' }),
    hi,
    note ? infoNote('Colour and height both show electric potential (voltage). Low = dark blue, high = yellow. The palette is safe for colour-blind viewers.', { label: 'About the colours' }) : null,
  );
  return {
    el,
    set(a, b) { lo.textContent = formatSI(a, 'V'); hi.textContent = formatSI(b, 'V'); },
  };
}

export class CircuitView {
  /**
   * @param o.layout        layout (bound with bindLayout)
   * @param o.pieces        height-map pieces [{ id, rev, dotStyle, x0, x1 }]; side view when x0/x1 are omitted
   * @param o.scales        shared screen scales { vMin, vMax, dotK, vmax, pushPerVolt, pRef, qPerMark }
   * @param o.heightMap     false to hide the height map
   * @param o.title         optional caption above the panel
   */
  constructor(parent, life, o) {
    this.life = life;
    this.o = o;
    this.scales = o.scales;
    this.sol = null;
    this.extra = {};
    this.el = h('div', { class: 'circuit-view' });
    if (o.title) this.el.appendChild(h('div', { class: 'cv-title', html: o.title }));
    parent.appendChild(this.el);
    const aspect = o.aspect || o.layout.h / o.layout.w;
    this.schem = new Stage(this.el, life, {
      aspect, minHeight: o.minHeight || 170, maxHeight: o.maxHeight || 420,
      label: o.label || 'Circuit schematic with moving charge dots', className: 'stage-schematic',
    });
    this.hm = null;
    if (o.heightMap !== false) {
      this.hmCaption = h('div', { class: 'hm-caption' },
        h('span', {}, 'Height map: potential around the loop'),
        infoNote('Height = potential. The battery is a lift that raises charge by ε. Wires are flat. Each resistor is a downhill ramp with a drop of IR. A capacitor is a step of height q/C.', { label: 'About the height map' }));
      this.el.appendChild(this.hmCaption);
      this.hm = new Stage(this.el, life, {
        aspect: o.hmAspect || 0.4, minHeight: o.hmMin || 130, maxHeight: o.hmMax || 210,
        label: 'Height map: potential around the loop', className: 'stage-heightmap',
      });
    }
    this.setLayout(o.layout, o.pieces);
  }

  setLayout(layout, pieces) {
    this.layout = layout;
    this.pieces = pieces || [];
    const old = this.dots;
    this.dots = new DotSystem(layout, { spacing: this.o.spacing || 5 });
    if (old) {
      // Keep phases for tracks that persist, so dots do not jump
      for (const t of this.dots.tracks) {
        const prev = old.byId.get(t.id);
        if (prev && prev.sp) t.phase = (prev.phase / prev.sp) * t.sp;
      }
    }
    this.schem.dirty = true;
  }

  setSolution(sol) {
    this.sol = sol && sol.ok ? sol : null;
    if (!this.sol) this.schem.showProblem("Can't compute this setup.");
    else this.schem.clearProblem();
  }

  /** Per-frame extras: labels, highlight, alpha, marker, annotations, assumed, dotStyles, hmMarker, hmLabels. */
  set(extra) { Object.assign(this.extra, extra); }

  transform() {
    const { layout } = this;
    return fitTransform(layout.w, layout.h, this.schem.w, this.schem.h, this.o.pad != null ? this.o.pad : 14);
  }

  frame(dt) {
    const sol = this.sol;
    const s = this.scales;
    this.dots.update(dt, sol ? sol.I : null, s.dotK, s.vmax || 60);
    if (!this.schem.visible && !(this.hm && this.hm.visible)) return;
    const T = this.transform();
    const x = this.extra;
    if (this.schem.visible) {
      const ctx = this.schem.begin(COLORS.panel);
      drawSchematic(ctx, T, this.layout, sol, {
        vMin: s.vMin, vMax: s.vMax,
        pushPerVolt: s.pushPerVolt ? s.pushPerVolt * T.scale : null,
        pRef: s.pRef, qPerMark: s.qPerMark,
        labels: x.labels, highlight: x.highlight, alpha: x.alpha,
        dots: sol ? this.dots : null, dotStyles: x.dotStyles,
        marker: x.marker, assumed: x.assumed,
      });
      if (x.drawSchematicExtra) x.drawSchematicExtra(ctx, T, this.schem);
    }
    if (this.hm && this.hm.visible) {
      const ctx = this.hm.begin(COLORS.panel);
      const W = this.hm.w;
      const H = this.hm.h;
      const pieces = this.mapPieces(T, W);
      drawHeightMap(ctx, W, H, this.layout, sol, {
        vMin: s.vMin, vMax: s.vMax, pieces,
        dots: sol ? this.dots : null,
        annotations: x.annotations ? x.annotations(T, W) : null,
        marker: x.hmMarker ? x.hmMarker(T, W) : null,
        labels: x.hmLabels, alpha: x.alpha, highlight: x.highlight,
        levels: x.levels,
        xOfPoint: (pt) => T.x(pt[0]),
      });
    }
  }

  /**
   * Resolve pieces to px: xa/xb = x of the track start/end, f0/f1 = body fractions (leads are flat).
   * Side view (no x0/x1 given) takes x from the schematic so ramps line up with their symbols.
   */
  mapPieces(T, W) {
    const padL = 44;
    const padR = 16;
    return this.pieces.map((p) => {
      const el = this.layout.elements[p.id];
      let a; let b; let f0 = 0; let f1 = 1;
      if (el) {
        a = el.a; b = el.b;
        const L = Math.hypot((b[0] - a[0]) * T.scale, (b[1] - a[1]) * T.scale) || 1;
        const half = Math.min(L / 2, bodyHalf(el.kind, L, T.scale));
        f0 = 0.5 - half / L;
        f1 = 0.5 + half / L;
      } else {
        const w = this.layout.wires.find((ww) => ww.id === p.id);
        if (!w) return { ...p, xa: 0, xb: 0, f0, f1 };
        a = w.pts[0]; b = w.pts[w.pts.length - 1];
        if (p.x0 == null) {
          const xs = w.pts.map((pt) => T.x(pt[0]));
          return { ...p, side: true, xa: T.x(a[0]), xb: T.x(b[0]), f0, f1, span: [Math.min(...xs), Math.max(...xs)] };
        }
      }
      if (p.x0 != null) {
        const x0 = padL + p.x0 * (W - padL - padR);
        const x1 = padL + p.x1 * (W - padL - padR);
        return p.rev ? { ...p, xa: x1, xb: x0, f0, f1 } : { ...p, xa: x0, xb: x1, f0, f1 };
      }
      return { ...p, side: true, xa: T.x(a[0]), xb: T.x(b[0]), f0, f1 };
    });
  }
}
