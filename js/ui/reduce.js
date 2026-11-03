// Animated transitions between circuit stages (e.g. collapsing a series pair into one resistor).
// Each stage is a real circuit solved by the solver; the transition cross-fades two layouts.
import { solveDC } from '../core/circuit.js';
import { bindLayout } from '../content/layouts.js';

const HOLD = 0.7;   // s to show the highlight before collapsing
const FADE = 0.7;   // s cross-fade

/** Merge two bound layouts with prefixed ids so both can be drawn with separate alphas. */
export function mergeLayouts(A, solA, B, solB) {
  const pre = (L, p) => {
    const elements = {};
    for (const [id, el] of Object.entries(L.elements)) {
      elements[p + id] = { ...el, flow: (el.flow || [[id, 1]]).map(([fid, s]) => [p + fid, s]) };
    }
    const wires = L.wires.map((w) => ({ ...w, id: p + w.id, flow: w.flow.map(([fid, s]) => [p + fid, s]) }));
    const junctions = (L.junctions || []).map((j) => ({ ...j, id: p + 'j' }));
    const pieces = (L.pieces || []).map((pc) => ({ ...pc, id: p + pc.id }));
    return { elements, wires, junctions, pieces };
  };
  const a = pre(A, 'o:');
  const b = pre(B, 'n:');
  const layout = {
    w: A.w, h: A.h, padTop: A.padTop, padBottom: A.padBottom,
    elements: { ...a.elements, ...b.elements },
    wires: [...a.wires, ...b.wires],
    junctions: [...a.junctions, ...b.junctions],
    pieces: [...a.pieces, ...b.pieces],
  };
  const I = {};
  const P = {};
  for (const k in solA.I) { I['o:' + k] = solA.I[k]; P['o:' + k] = solA.P[k]; }
  for (const k in solB.I) { I['n:' + k] = solB.I[k]; P['n:' + k] = solB.P[k]; }
  const sol = { ok: true, V: { ...solA.V, ...solB.V }, I, P };
  return { layout, sol, idsA: Object.keys(a.elements).concat(a.wires.map((w) => w.id), ['o:j']), idsB: Object.keys(b.elements).concat(b.wires.map((w) => w.id), ['n:j']) };
}

/**
 * Drives a CircuitView through stages. stageFn(stage) → { circuit, layout } (unbound layout is fine).
 * labelsFn(stage, sol) → { labels, hmLabels } for the view.
 */
export class StageAnimator {
  constructor(view, stageFn, labelsFn) {
    this.view = view;
    this.stageFn = stageFn;
    this.labelsFn = labelsFn;
    this.stage = 0;
    this.anim = null;
    this.highlight = new Set();
    this.extraHighlight = null;
    this.show(0);
  }

  build(stage) {
    const { circuit, layout } = this.stageFn(stage);
    bindLayout(layout, circuit);
    const sol = solveDC(circuit);
    return { circuit, layout, sol };
  }

  /** Jump straight to a stage. */
  show(stage, highlight = []) {
    this.anim = null;
    this.stage = stage;
    const cur = this.build(stage);
    this.cur = cur;
    this.view.setLayout(cur.layout, cur.layout.pieces);
    this.view.setSolution(cur.sol);
    this.highlight = new Set(highlight);
    this.view.set({ alpha: null, highlight: this.highlight, ...this.labelsFn(stage, cur.sol, '') });
  }

  /** Animate to a stage: optionally hold a highlight on `groupIds` (ids in the current stage) first. */
  goTo(stage, { groupIds = [], hold = true, after = [] } = {}) {
    if (stage === this.stage && !this.anim) { this.view.set({ highlight: new Set(after.length ? after : groupIds) }); return; }
    const from = this.anim ? this.anim.to : this.build(this.stage);
    const to = this.build(stage);
    if (!from.sol.ok || !to.sol.ok) { this.show(stage); return; }
    this.anim = { from, to, toStage: stage, t: hold && groupIds.length ? -HOLD : 0, merged: null, groupIds, after };
    this.view.setLayout(from.layout, from.layout.pieces);
    this.view.setSolution(from.sol);
    this.view.set({ alpha: null, highlight: new Set(groupIds), ...this.labelsFn(this.stage, from.sol, '') });
  }

  frame(dt) {
    const a = this.anim;
    if (!a) return;
    const before = a.t;
    a.t += dt;
    if (before < 0 && a.t >= 0 || (!a.merged && a.t >= 0)) {
      const m = mergeLayouts(a.from.layout, a.from.sol, a.to.layout, a.to.sol);
      a.merged = m;
      this.view.setLayout(m.layout, m.layout.pieces);
      this.view.setSolution(m.sol);
      const lf = this.labelsFn(this.stage, a.from.sol, 'o:');
      const lt = this.labelsFn(a.toStage, a.to.sol, 'n:');
      this.view.set({
        labels: { ...lf.labels, ...lt.labels },
        hmLabels: { ...lf.hmLabels, ...lt.hmLabels },
        highlight: new Set(a.groupIds.map((id) => 'o:' + id)),
      });
    }
    if (a.t < 0) return;
    const f = Math.min(1, a.t / FADE);
    const e = f * f * (3 - 2 * f);
    const alpha = {};
    for (const id of a.merged.idsA) alpha[id] = 1 - e;
    for (const id of a.merged.idsB) alpha[id] = e;
    // shared battery and outer wires should not flicker: keep them solid
    for (const id of a.merged.idsA) {
      const bare = id.slice(2);
      if (a.merged.idsB.includes('n:' + bare) && samePlace(a.from.layout, a.to.layout, bare)) { alpha[id] = 1; alpha['n:' + bare] = 0; }
    }
    this.view.set({ alpha });
    if (f >= 1) {
      this.anim = null;
      this.stage = a.toStage;
      this.show(a.toStage, a.after || []);
    }
  }

  get busy() { return !!this.anim; }
}

function samePlace(A, B, id) {
  const ea = A.elements[id];
  const eb = B.elements[id];
  if (ea && eb) return JSON.stringify([ea.a, ea.b]) === JSON.stringify([eb.a, eb.b]);
  const wa = A.wires.find((w) => w.id === id);
  const wb = B.wires.find((w) => w.id === id);
  return !!(wa && wb && JSON.stringify(wa.pts) === JSON.stringify(wb.pts));
}
