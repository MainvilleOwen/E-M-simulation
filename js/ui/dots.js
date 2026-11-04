// Charge dots. Each wire and each conducting element is a "track". Dots sit evenly spaced along
// every track (same density everywhere) and move at a speed proportional to that track's current,
// so the flow of dots into a junction equals the flow out (Kirchhoff's junction rule).
// Dots show conventional (positive) current.

export const MAX_DOTS = 300;

/** Point keys of every capacitor terminal in a layout. */
export function plateKeys(layout) {
  const set = new Set();
  for (const el of Object.values(layout.elements || {})) if (el.kind === 'capacitor') { set.add(keyOf(el.a)); set.add(keyOf(el.b)); }
  return set;
}

/** Build tracks from a layout: wires plus every element that conducts (not capacitors). */
export function buildTracks(layout) {
  const tracks = [];
  for (const w of layout.wires || []) {
    tracks.push({ id: w.id, pts: w.pts, flow: w.flow || [] });
  }
  for (const [id, el] of Object.entries(layout.elements || {})) {
    if (el.kind === 'capacitor' || el.noDots) continue;
    // An open switch has a gap: no charge sits inside it.
    const isOpen = el.kind === 'switch' ? () => !(el.ref && el.ref.closed) : null;
    tracks.push({ id, pts: [el.a, el.b], flow: el.flow || [[id, 1]], isOpen });
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

const keyOf = (p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;

export class DotSystem {
  /**
   * Dots are particles. Each one rides a track; when it reaches the end it passes through the junction
   * onto a track that carries current away, chosen so each outgoing branch gets its share of the flow.
   * Nothing wraps or blinks. Where current ends at a capacitor plate, dots join the pile there;
   * where current leaves a plate, new dots come out of it.
   * @param layout   circuit layout
   * @param opts.spacing   preferred spacing between dots, in layout units
   */
  constructor(layout, { spacing = 5 } = {}) {
    this.tracks = buildTracks(layout);
    const total = this.tracks.reduce((s, t) => s + t.len, 0);
    this.spacing = Math.max(spacing, total / MAX_DOTS);
    this.byId = new Map();
    this.nodes = new Map(); // point key → [{ t, atStart }]
    this.dots = [];
    const link = (k, t, atStart) => { if (!this.nodes.has(k)) this.nodes.set(k, []); this.nodes.get(k).push({ t, atStart }); };
    for (const t of this.tracks) {
      t.k0 = keyOf(t.pts[0]);
      t.k1 = keyOf(t.pts[t.pts.length - 1]);
      link(t.k0, t, true);
      link(t.k1, t, false);
      t.current = 0;
      t.speed = 0;
      this.byId.set(t.id, t);
      const n = t.len < 0.35 * this.spacing ? 0 : Math.max(1, Math.round(t.len / this.spacing));
      for (let j = 0; j < n; j++) this.dots.push({ t, s: ((j + 0.5) * t.len) / n });
    }
    this.plates = plateKeys(layout);
    this.credit = new Map();
    this.emitAcc = new Map();
    this.clamped = false;
  }

  get count() { return this.dots.length; }

  /** Current through a track from the solver result (signed along the track's point order). */
  static trackCurrent(track, I) {
    let s = 0;
    for (const [id, sign] of track.flow) s += sign * (I[id] || 0);
    return s;
  }

  /** Tracks at a node that carry flow away from it, with their flow weights. */
  outgoing(k) {
    const out = [];
    for (const { t, atStart } of this.nodes.get(k) || []) {
      const v = atStart ? t.speed : -t.speed;
      if (v > 1e-9) out.push({ t, atStart, w: v });
    }
    return out;
  }

  /** Pick an outgoing track so each branch receives its share of dots (largest-credit routing). */
  route(k) {
    const out = this.outgoing(k);
    if (!out.length) return null;
    const W = out.reduce((a, o) => a + o.w, 0);
    let cr = this.credit.get(k);
    if (!cr) { cr = new Map(); this.credit.set(k, cr); }
    let best = null;
    for (const o of out) {
      const c = (cr.get(o.t) || 0) + o.w / W;
      cr.set(o.t, c);
      if (!best || c > cr.get(best.t)) best = o;
    }
    cr.set(best.t, cr.get(best.t) - 1);
    return best;
  }

  /**
   * Advance the dots.
   * @param dt    real seconds
   * @param I     solver currents by element id
   * @param k     speed scale: layout units per second per ampere (shared across a screen)
   * @param vmax  speed limit in layout units per second (prevents wagon-wheel aliasing)
   */
  update(dt, I, k, vmax = 60) {
    // One common slow-down if any track is too fast, so the junction rule still holds for the dots.
    let vBig = 0;
    for (const t of this.tracks) {
      const cur = I ? DotSystem.trackCurrent(t, I) : 0;
      t.current = cur;
      t.speed = Number.isFinite(k * cur) ? k * cur : 0;
      if (t.isOpen && t.isOpen()) t.speed = 0;
      vBig = Math.max(vBig, Math.abs(t.speed));
    }
    const scale = vBig > vmax ? vmax / vBig : 1;
    this.clamped = scale < 1;
    if (scale < 1) for (const t of this.tracks) t.speed *= scale;
    if (!(dt > 0)) return;

    const born = [];
    for (const d of this.dots) {
      d.s += d.t.speed * dt;
      for (let hop = 0; hop < 4 && !d.dead; hop++) {
        let over; let k0;
        if (d.s > d.t.len) { over = d.s - d.t.len; k0 = d.t.k1; } else if (d.s < 0) { over = -d.s; k0 = d.t.k0; } else break;
        const next = this.route(k0);
        if (!next) {
          // Nowhere to go: a capacitor plate (it joins the pile) or a dead end (it waits there).
          if (this.isPlate(k0)) d.dead = true;
          else d.s = Math.max(0, Math.min(d.t.len, d.s));
          break;
        }
        d.t = next.t;
        d.s = next.atStart ? Math.min(over, d.t.len) : Math.max(0, d.t.len - over);
      }
    }
    // Sources: where more flow leaves a node than arrives (a capacitor plate giving up charge), emit dots.
    for (const [kk, list] of this.nodes) {
      let inF = 0; let outF = 0;
      for (const { t, atStart } of list) { const v = atStart ? t.speed : -t.speed; if (v > 0) outF += v; else inF -= v; }
      const extra = outF - inF;
      if (extra <= 1e-9 || !this.isPlate(kk)) { this.emitAcc.delete(kk); continue; }
      let acc = (this.emitAcc.get(kk) || 0) + (extra * dt) / this.spacing;
      while (acc >= 1) {
        acc -= 1;
        const o = this.route(kk);
        if (o) born.push({ t: o.t, s: o.atStart ? 0.01 : o.t.len - 0.01 });
      }
      this.emitAcc.set(kk, acc);
    }
    this.dots = this.dots.filter((d) => !d.dead).concat(born);
    if (this.dots.length > MAX_DOTS) this.dots.splice(0, this.dots.length - MAX_DOTS);
  }

  /** Is this point a capacitor terminal (or any spot with only one connected track)? */
  isPlate(k) {
    return !!(this.plates && this.plates.has(k));
  }

  /** Call cb(f, [x, y]) for each dot on a track; f is the fraction along the track (0..1). */
  eachDot(id, cb) {
    const t = this.byId.get(id);
    if (!t || (t.isOpen && t.isOpen())) return;
    for (const d of this.dots) if (d.t === t) cb(d.s / t.len, pointAt(t, d.s));
  }

  /** Draw all dots onto the schematic. T maps layout → px. */
  draw(ctx, T, { radius = 4, alpha = null, hidden = null, styles = null } = {}) {
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const d of this.dots) {
      const t = d.t;
      if (hidden && hidden.has(t.id)) continue;
      if (t.isOpen && t.isOpen()) continue;
      const a = alpha && alpha[t.id] != null ? alpha[t.id] : 1;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const [x, y] = pointAt(t, d.s);
      drawDot(ctx, T.x(x), T.y(y), radius, styles && styles[t.id]);
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
