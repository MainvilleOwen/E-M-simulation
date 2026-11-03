// Walk the loop: a marker travels around a chosen loop and keeps a running sum of potential changes
// (+ε through a battery from − to +, −IR through a resistor in the direction of the assumed current).
import { pointAt } from './dots.js';
import { pieceInfo, potentialAlong } from './heightmap.js';
import { bodyHalf } from './schematic.js';

const WIDTH = { battery: 0.8, resistor: 1.3, bulb: 1.3, wire: 0.7, switch: 0.8, capacitor: 0.8 };

/** Unrolled height-map pieces for a loop: [{ id, rev, x0, x1 }] with x in 0..1. */
export function loopPieces(layout, loop) {
  const ws = loop.steps.map(([id]) => WIDTH[(pieceInfo(layout, id) || {}).kind] || 0.7);
  const total = ws.reduce((s, w) => s + w, 0);
  let x = 0;
  return loop.steps.map(([id, rev], i) => {
    const x0 = x / total;
    x += ws[i];
    return { id, rev, x0, x1: x / total };
  });
}

function trackGeom(layout, id) {
  const el = layout.elements[id];
  const pts = el ? [el.a, el.b] : layout.wires.find((w) => w.id === id).pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export class LoopWalker {
  /**
   * @param layout   bound layout
   * @param loop     { steps: [[id, reversed]] }
   * @param o.speed  pieces per second
   */
  constructor(layout, loop, { speed = 0.9 } = {}) {
    this.layout = layout;
    this.loop = loop;
    this.speed = speed;
    this.s = 0;
    this.playing = false;
    this.geoms = loop.steps.map(([id]) => trackGeom(layout, id));
  }

  reset() { this.s = 0; this.playing = false; }
  get done() { return this.s >= this.loop.steps.length - 1e-9; }

  frame(dt) {
    if (!this.playing) return;
    this.s = Math.min(this.loop.steps.length, this.s + dt * this.speed);
    if (this.done) this.playing = false;
  }

  /** Jump to just past the next element (battery or resistor), or to the end of the loop. */
  stepToNext() {
    const n = this.loop.steps.length;
    for (let j = Math.floor(this.s + 1e-9); j < n; j++) {
      const info = pieceInfo(this.layout, this.loop.steps[j][0]);
      if (info.kind !== 'wire' && this.s < j + 1 - 1e-9) { this.s = j + 1; return; }
    }
    this.s = n;
  }

  /** Current position: { k, g (0..1 traversal), f (track fraction) }. */
  where() {
    const n = this.loop.steps.length;
    const s = Math.min(this.s, n - 1e-9);
    const k = Math.floor(s);
    const g = s - k;
    const [, rev] = this.loop.steps[k];
    return { k, g, f: rev ? 1 - g : g };
  }

  /** Marker point in layout units. */
  point() {
    const { k, f } = this.where();
    const geo = this.geoms[k];
    return pointAt(geo, f * geo.len);
  }

  /** Body fractions of a loop element for a given px scale (matches the schematic symbol). */
  bodyFractions(k, scale) {
    const [id] = this.loop.steps[k];
    const el = this.layout.elements[id];
    if (!el) return [0, 1];
    const L = Math.hypot(el.b[0] - el.a[0], el.b[1] - el.a[1]) * scale || 1;
    const half = Math.min(L / 2, bodyHalf(el.kind, L, scale));
    return [0.5 - half / L, 0.5 + half / L];
  }

  /** Potential at the marker (volts). */
  potential(sol, scale) {
    const { k, f } = this.where();
    const info = pieceInfo(this.layout, this.loop.steps[k][0]);
    const [f0, f1] = this.bodyFractions(k, scale);
    return potentialAlong(sol, info, f, f0, f1);
  }

  /** Potential at the start of the loop. */
  startPotential(sol) {
    const [id, rev] = this.loop.steps[0];
    const info = pieceInfo(this.layout, id);
    return potentialAlong(sol, info, rev ? 1 : 0);
  }

  /** Elements fully passed so far (indices), in order. */
  passed() {
    const out = [];
    for (let k = 0; k < this.loop.steps.length; k++) {
      const info = pieceInfo(this.layout, this.loop.steps[k][0]);
      if (info.kind === 'wire') continue;
      if (this.s >= k + 0.75 - 1e-9) out.push(k);
    }
    return out;
  }
}
