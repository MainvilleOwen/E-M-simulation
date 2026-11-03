// Charge dots. Each wire and each conducting element is a "track". Dots sit evenly spaced along
// every track (same density everywhere) and move at a speed proportional to that track's current,
// so the flow of dots into a junction equals the flow out (Kirchhoff's junction rule).
// Dots show conventional (positive) current.

export const MAX_DOTS = 300;

/** Build tracks from a layout: wires plus every element that conducts (not capacitors). */
export function buildTracks(layout) {
  const tracks = [];
  for (const w of layout.wires || []) {
    tracks.push({ id: w.id, pts: w.pts, flow: w.flow || [] });
  }
  for (const [id, el] of Object.entries(layout.elements || {})) {
    if (el.kind === 'capacitor' || el.noDots) continue;
    tracks.push({ id, pts: [el.a, el.b], flow: el.flow || [[id, 1]] });
  }
  for (const t of tracks) {
    const cum = [0];
    for (let i = 1; i < t.pts.length; i++) {
      const [x0, y0] = t.pts[i - 1];
      const [x1, y1] = t.pts[i];
      cum.push(cum[i - 1] + Math.hypot(x1 - x0, y1 - y0));
    }
    t.cum = cum;
    t.len = cum[cum.length - 1];
  }
  return tracks;
}

/** Point at arc length s along a track (layout units). */
export function pointAt(track, s) {
  const { pts, cum } = track;
  if (s <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i]) {
      const seg = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
  }
  return pts[pts.length - 1];
}

export class DotSystem {
  /**
   * @param layout   circuit layout
   * @param opts.spacing   preferred spacing between dots, in layout units
   */
  constructor(layout, { spacing = 5 } = {}) {
    this.tracks = buildTracks(layout);
    const total = this.tracks.reduce((s, t) => s + t.len, 0);
    this.spacing = Math.max(spacing, total / MAX_DOTS);
    this.byId = new Map();
    let count = 0;
    for (const t of this.tracks) {
      const n = t.len < 0.35 * this.spacing ? 0 : Math.max(1, Math.round(t.len / this.spacing));
      t.n = n;
      t.sp = n > 0 ? t.len / n : t.len;
      t.phase = 0;
      t.current = 0;
      t.speed = 0;
      count += n;
      this.byId.set(t.id, t);
    }
    this.count = count;
    this.clamped = false;
  }

  /** Current through a track from the solver result (signed along the track's point order). */
  static trackCurrent(track, I) {
    let s = 0;
    for (const [id, sign] of track.flow) s += sign * (I[id] || 0);
    return s;
  }

  /**
   * Advance the dots.
   * @param dt    real seconds
   * @param I     solver currents by element id
   * @param k     speed scale: layout units per second per ampere (shared across a screen)
   * @param vmax  speed limit in layout units per second (prevents wagon-wheel aliasing)
   */
  update(dt, I, k, vmax = 60) {
    let clamped = false;
    for (const t of this.tracks) {
      const cur = I ? DotSystem.trackCurrent(t, I) : 0;
      let v = k * cur;
      if (!Number.isFinite(v)) v = 0;
      if (Math.abs(v) > vmax) { v = Math.sign(v) * vmax; clamped = true; }
      t.current = cur;
      t.speed = v;
      if (t.n > 0) {
        t.phase = (t.phase + v * dt) % t.sp;
        if (t.phase < 0) t.phase += t.sp;
      }
    }
    this.clamped = clamped;
  }

  /** Call cb(f, [x, y]) for each dot on a track; f is the fraction along the track (0..1). */
  eachDot(id, cb) {
    const t = this.byId.get(id);
    if (!t || t.n === 0) return;
    for (let j = 0; j < t.n; j++) {
      const s = t.phase + j * t.sp;
      cb(s / t.len, pointAt(t, s));
    }
  }

  /** Draw all dots onto the schematic. T maps layout → px. */
  draw(ctx, T, { radius = 4, alpha = null, hidden = null, styles = null } = {}) {
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const t of this.tracks) {
      if (t.n === 0) continue;
      if (hidden && hidden.has(t.id)) continue;
      const a = alpha && alpha[t.id] != null ? alpha[t.id] : 1;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const style = styles && styles[t.id];
      for (let j = 0; j < t.n; j++) {
        const s = t.phase + j * t.sp;
        const [x, y] = pointAt(t, s);
        drawDot(ctx, T.x(x), T.y(y), radius, style);
      }
    }
    ctx.restore();
  }
}

export function drawDot(ctx, x, y, r, style) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (style === 'ring') {
    ctx.fillStyle = '#0b0f18';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, r * 0.55);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0b0f18';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
