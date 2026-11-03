// Circuit core: modified nodal analysis (MNA) for DC and transient analysis. Pure, no DOM.
//
// A circuit is a plain object: { ground: '0', elements: [ ... ] }
// Element kinds (every element has a unique `id`):
//   { type: 'R', id, a, b, R }                resistor (bulbs are resistors)
//   { type: 'V', id, neg, pos, V, r = 0 }     battery: V(pos) − V(neg) = V − I·r
//   { type: 'C', id, a, b, C, q0 = 0 }        capacitor; q is the charge on plate a, q = C·(Va − Vb)
//   { type: 'S', id, a, b, closed }           switch: closed = 1e-6 Ω, open = removed
//
// Sign conventions used in every result:
//   I[id] is the current through the element from terminal a to terminal b.
//   For a battery, a = neg and b = pos, so I > 0 means the battery is pushing current out of its + terminal.
//   P[id] = I·(Va − Vb) is the power absorbed by the element (negative for a battery that is delivering).
//
// Nothing here throws into the UI: failures return { ok: false, reason }.

export const SWITCH_CLOSED_R = 1e-6;
const PIVOT_REL_TOL = 1e-14;

// ---------------------------------------------------------------------------
// Dense linear algebra: LU with partial pivoting (circuits here have < 20 nodes)
// ---------------------------------------------------------------------------

/** Factor A (row-major Float64Array, n×n) in place. Returns pivot array, or null if singular. */
export function luFactor(A, n) {
  let maxAbs = 0;
  for (let i = 0; i < n * n; i++) maxAbs = Math.max(maxAbs, Math.abs(A[i]));
  if (!(maxAbs > 0) || !Number.isFinite(maxAbs)) return null;
  const tol = PIVOT_REL_TOL * maxAbs;
  const piv = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    let p = k;
    let best = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > best) { best = v; p = i; }
    }
    if (!(best > tol)) return null;
    piv[k] = p;
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t;
      }
    }
    const d = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = (A[i * n + k] /= d);
      if (f !== 0) {
        for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
  }
  return piv;
}

/** Solve using a factorization from luFactor. b is not modified; returns a new Float64Array. */
export function luSolve(LU, piv, b, n) {
  const x = Float64Array.from(b);
  for (let k = 0; k < n; k++) {
    const p = piv[k];
    if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; }
  }
  for (let i = 1; i < n; i++) {
    let s = x[i];
    for (let j = 0; j < i; j++) s -= LU[i * n + j] * x[j];
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= LU[i * n + j] * x[j];
    x[i] = s / LU[i * n + i];
  }
  return x;
}

/** Gaussian elimination with partial pivoting. Returns solution or null if singular. */
export function solveLinear(A, b, n) {
  const M = Float64Array.from(A);
  const piv = luFactor(M, n);
  if (!piv) return null;
  return luSolve(M, piv, b, n);
}

// ---------------------------------------------------------------------------
// Circuit normalisation and validation
// ---------------------------------------------------------------------------

function fail(reason) { return { ok: false, reason }; }

function isPos(x) { return typeof x === 'number' && Number.isFinite(x) && x > 0; }

/**
 * Normalise a circuit into terminals a/b for every element and index the nodes.
 * Returns { ok, ground, nodes, index, elems } or { ok:false, reason }.
 */
export function normalize(circuit) {
  if (!circuit || !Array.isArray(circuit.elements)) return fail('circuit has no elements');
  const ground = circuit.ground != null ? String(circuit.ground) : '0';
  const elems = [];
  const ids = new Set();
  for (const e of circuit.elements) {
    if (!e || !e.id) return fail('element without id');
    if (ids.has(e.id)) return fail(`duplicate element id ${e.id}`);
    ids.add(e.id);
    let a, b;
    if (e.type === 'V') { a = e.neg; b = e.pos; } else { a = e.a; b = e.b; }
    if (a == null || b == null) return fail(`element ${e.id} is missing a terminal`);
    a = String(a); b = String(b);
    switch (e.type) {
      case 'R':
        if (!isPos(e.R)) return fail(`resistor ${e.id} needs R > 0`);
        break;
      case 'V':
        if (typeof e.V !== 'number' || !Number.isFinite(e.V)) return fail(`source ${e.id} needs a finite V`);
        if (e.r != null && (!Number.isFinite(e.r) || e.r < 0)) return fail(`source ${e.id} has invalid r`);
        break;
      case 'C':
        if (!isPos(e.C)) return fail(`capacitor ${e.id} needs C > 0`);
        if (e.q0 != null && !Number.isFinite(e.q0)) return fail(`capacitor ${e.id} has invalid q0`);
        break;
      case 'S':
        break;
      default:
        return fail(`unknown element type ${e.type}`);
    }
    if (a === b && e.type !== 'S') return fail(`element ${e.id} has both terminals on node ${a}`);
    elems.push({ src: e, type: e.type, id: e.id, a, b });
  }
  const names = new Set([ground]);
  for (const el of elems) { names.add(el.a); names.add(el.b); }
  const nodes = [...names].filter((n) => n !== ground);
  const index = new Map(nodes.map((n, i) => [n, i]));
  index.set(ground, -1);
  return { ok: true, ground, nodes, index, elems };
}

/** Does this element conduct (connect its two nodes) in the given analysis mode? */
function conducts(el, mode) {
  if (el.type === 'S') return !!el.src.closed;
  if (el.type === 'C') return mode !== 'dc';
  return true;
}

/** Union-find connectivity: every node must reach ground through conducting elements. */
function findFloating(norm, mode) {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    let y = x;
    while (parent.get(y) !== r) { const nx = parent.get(y); parent.set(y, r); y = nx; }
    return r;
  };
  parent.set(norm.ground, norm.ground);
  for (const n of norm.nodes) parent.set(n, n);
  for (const el of norm.elems) {
    if (!conducts(el, mode) || el.a === el.b) continue;
    const ra = find(el.a); const rb = find(el.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const g = find(norm.ground);
  return norm.nodes.filter((n) => find(n) !== g);
}

// ---------------------------------------------------------------------------
// MNA assembly
// ---------------------------------------------------------------------------
// mode: 'dc'   capacitors open
//       'ic'   capacitors are ideal voltage sources holding their present voltage (consistent t=0+ state)
//       'tran' capacitors replaced by companion models { Geq, Ihist } from capModel(el)

function assemble(norm, mode, capModel) {
  const floating = findFloating(norm, mode);
  if (floating.length) return fail(`floating node: ${floating.join(', ')}`);
  const n = norm.nodes.length;
  const extras = []; // elements that add a current unknown
  for (const el of norm.elems) {
    if (el.type === 'V' && !(el.src.r > 0)) extras.push(el);
    else if (el.type === 'C' && mode === 'ic') extras.push(el);
  }
  const size = n + extras.length;
  if (size === 0) return fail('empty circuit');
  const A = new Float64Array(size * size);
  const rhs = new Float64Array(size);
  const idx = norm.index;
  const add = (r, c, v) => { if (r >= 0 && c >= 0) A[r * size + c] += v; };
  const addR = (r, v) => { if (r >= 0) rhs[r] += v; };
  const stampG = (a, b, G) => { add(a, a, G); add(b, b, G); add(a, b, -G); add(b, a, -G); };
  const extraIndex = new Map();
  extras.forEach((el, k) => extraIndex.set(el.id, n + k));

  for (const el of norm.elems) {
    const a = idx.get(el.a);
    const b = idx.get(el.b);
    const s = el.src;
    switch (el.type) {
      case 'R':
        stampG(a, b, 1 / s.R);
        break;
      case 'S':
        if (s.closed) stampG(a, b, 1 / SWITCH_CLOSED_R);
        break;
      case 'V': {
        if (s.r > 0) {
          // Norton form: I(a→b) = V/r + (Va − Vb)/r
          const G = 1 / s.r;
          stampG(a, b, G);
          addR(a, -s.V * G);
          addR(b, s.V * G);
        } else {
          const k = extraIndex.get(el.id);
          add(a, k, 1); add(b, k, -1);           // current leaves a, enters b
          add(k, b, 1); add(k, a, -1);           // Vb − Va = V
          rhs[k] += s.V;
        }
        break;
      }
      case 'C': {
        if (mode === 'dc') break;
        if (mode === 'ic') {
          const k = extraIndex.get(el.id);
          const v = capModel(el).v;
          add(a, k, 1); add(b, k, -1);
          add(k, a, 1); add(k, b, -1);           // Va − Vb = v
          rhs[k] += v;
        } else {
          const { Geq, Ihist } = capModel(el);
          stampG(a, b, Geq);
          addR(a, Ihist);
          addR(b, -Ihist);
        }
        break;
      }
      default:
        break;
    }
  }
  return { ok: true, A, rhs, size, n, extraIndex };
}

function extract(norm, sys, x, mode, capModel) {
  const V = { [norm.ground]: 0 };
  norm.nodes.forEach((name, i) => { V[name] = x[i]; });
  const I = {};
  const P = {};
  for (const el of norm.elems) {
    const s = el.src;
    const va = V[el.a];
    const vb = V[el.b];
    let i = 0;
    switch (el.type) {
      case 'R': i = (va - vb) / s.R; break;
      case 'S': i = s.closed ? (va - vb) / SWITCH_CLOSED_R : 0; break;
      case 'V':
        i = s.r > 0 ? (s.V - (vb - va)) / s.r : x[sys.extraIndex.get(el.id)];
        break;
      case 'C':
        if (mode === 'dc') i = 0;
        else if (mode === 'ic') i = x[sys.extraIndex.get(el.id)];
        else { const m = capModel(el); i = m.Geq * (va - vb) - m.Ihist; }
        break;
      default: break;
    }
    I[el.id] = i;
    P[el.id] = i * (va - vb);
  }
  for (const k in V) if (!Number.isFinite(V[k])) return fail('result is not finite');
  for (const k in I) if (!Number.isFinite(I[k])) return fail('result is not finite');
  return { ok: true, V, I, P };
}

// ---------------------------------------------------------------------------
// DC steady state (capacitors open)
// ---------------------------------------------------------------------------

export function solveDC(circuit) {
  try {
    const norm = normalize(circuit);
    if (!norm.ok) return norm;
    const sys = assemble(norm, 'dc');
    if (!sys.ok) return sys;
    const x = solveLinear(sys.A, sys.rhs, sys.size);
    if (!x) return fail('singular circuit (check for a loop of ideal batteries or a short)');
    const res = extract(norm, sys, x, 'dc');
    if (!res.ok) return res;
    // In steady state capacitors hold q = C·(Va − Vb)
    res.q = {};
    for (const el of norm.elems) {
      if (el.type === 'C') res.q[el.id] = el.src.C * (res.V[el.a] - res.V[el.b]);
    }
    return res;
  } catch (err) {
    return fail(`solver error: ${err && err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Transient analysis: trapezoidal companion model for capacitors
// ---------------------------------------------------------------------------

export class Transient {
  /**
   * @param circuit  circuit object (it is referenced, not copied: change switch states on it, then call rebuild()).
   * @param opts.dt  fixed timestep in seconds
   * @param opts.method 'trap' (default) | 'be' (backward Euler) | 'auto' (BE when dt is large vs the smallest τ)
   */
  constructor(circuit, { dt = 1e-3, method = 'trap' } = {}) {
    this.circuit = circuit;
    this.dt = dt;
    this.method = method;
    this.t = 0;
    this.steps = 0;
    this.caps = new Map(); // id → { v, i }
    this.energy = {};      // id → energy absorbed (J) since t = 0
    this.ok = true;
    this.reason = '';
    for (const e of circuit.elements) {
      if (e.type === 'C') this.caps.set(e.id, { v: (e.q0 || 0) / e.C, i: 0 });
      this.energy[e.id] = 0;
    }
    this.rebuild();
  }

  /** Call after changing the circuit (switch toggled, value changed). Capacitor voltages carry over. */
  rebuild() {
    const norm = normalize(this.circuit);
    if (!norm.ok) return this._fail(norm.reason);
    this.norm = norm;
    for (const el of norm.elems) {
      if (el.type === 'C' && !this.caps.has(el.id)) {
        this.caps.set(el.id, { v: (el.src.q0 || 0) / el.src.C, i: 0 });
      }
      if (!(el.id in this.energy)) this.energy[el.id] = 0;
    }
    this.factors = {};
    this.forceBE = 0;
    this.tauMin = Infinity;
    if (this.method === 'auto') {
      const taus = estimateTimeConstants(this.circuit);
      this.tauMin = taus.ok ? taus.tauMin : Infinity;
    }
    // Consistent state just after the change: capacitors act as voltage sources at their present voltage.
    const ic = assemble(norm, 'ic', (el) => this.caps.get(el.id));
    let state = null;
    if (ic.ok) {
      const x = solveLinear(ic.A, ic.rhs, ic.size);
      if (x) {
        const res = extract(norm, ic, x, 'ic');
        if (res.ok) state = res;
      }
    }
    if (state) {
      for (const [id, c] of this.caps) {
        if (id in state.I) c.i = state.I[id];
      }
    } else {
      // A loop of capacitors and ideal sources: start with backward Euler steps, which need no current history.
      this.forceBE = 2;
      const probe = this._trial('be');
      if (!probe.ok) return this._fail(probe.reason);
      state = probe.res;
    }
    this.ok = true;
    this.reason = '';
    this.state = this._decorate(state);
    return this;
  }

  setDt(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    if (dt !== this.dt) { this.dt = dt; this.factors = {}; }
  }

  _fail(reason) {
    this.ok = false;
    this.reason = reason;
    this.state = null;
    return this;
  }

  _model(kind) {
    const dt = this.dt;
    return (el) => {
      const c = this.caps.get(el.id);
      const C = el.src.C;
      if (kind === 'be') {
        const Geq = C / dt;
        return { Geq, Ihist: Geq * c.v };
      }
      const Geq = (2 * C) / dt;
      return { Geq, Ihist: Geq * c.v + c.i };
    };
  }

  _factor(kind) {
    if (this.factors[kind]) return this.factors[kind];
    const base = this._model(kind);
    // Assemble with zero history so the stored RHS holds only the sources; history is added per step.
    const sys = assemble(this.norm, 'tran', (el) => ({ Geq: base(el).Geq, Ihist: 0 }));
    if (!sys.ok) return sys;
    const LU = Float64Array.from(sys.A);
    const piv = luFactor(LU, sys.size);
    if (!piv) return fail('singular circuit');
    const capTerms = this.norm.elems
      .filter((el) => el.type === 'C')
      .map((el) => ({ el, a: this.norm.index.get(el.a), b: this.norm.index.get(el.b) }));
    const f = { ok: true, LU, piv, size: sys.size, sys, staticRhs: sys.rhs, capTerms };
    this.factors[kind] = f;
    return f;
  }

  _rhs(kind, f) {
    const rhs = Float64Array.from(f.staticRhs);
    const model = this._model(kind);
    for (const { el, a, b } of f.capTerms) {
      const { Ihist } = model(el);
      if (a >= 0) rhs[a] += Ihist;
      if (b >= 0) rhs[b] -= Ihist;
    }
    return rhs;
  }

  _trial(kind) {
    const f = this._factor(kind);
    if (!f.ok) return f;
    const rhs = this._rhs(kind, f);
    const x = luSolve(f.LU, f.piv, rhs, f.size);
    const model = this._model(kind);
    const res = extract(this.norm, f.sys, x, 'tran', model);
    if (!res.ok) return res;
    return { ok: true, res };
  }

  _chooseKind() {
    if (this.forceBE > 0) return 'be';
    if (this.method === 'be') return 'be';
    if (this.method === 'auto' && this.dt > this.tauMin) return 'be';
    return 'trap';
  }

  /** Advance n fixed steps. Returns false (and sets ok=false) if the circuit cannot be computed. */
  step(n = 1) {
    if (!this.ok) return false;
    for (let s = 0; s < n; s++) {
      const kind = this._chooseKind();
      const prev = this.state;
      const r = this._trial(kind);
      if (!r.ok) { this._fail(r.reason); return false; }
      const res = r.res;
      for (const el of this.norm.elems) {
        if (el.type !== 'C') continue;
        const c = this.caps.get(el.id);
        c.v = res.V[el.a] - res.V[el.b];
        c.i = res.I[el.id];
      }
      const dt = this.dt;
      for (const id in res.P) {
        const p0 = prev && prev.P ? prev.P[id] || 0 : 0;
        this.energy[id] = (this.energy[id] || 0) + 0.5 * (p0 + res.P[id]) * dt;
      }
      this.t += dt;
      this.steps++;
      if (this.forceBE > 0) this.forceBE--;
      this.state = this._decorate(res);
    }
    return true;
  }

  /** Run until time T (absolute). */
  runUntil(T) {
    const n = Math.max(0, Math.round((T - this.t) / this.dt));
    return this.step(n);
  }

  _decorate(res) {
    const q = {};
    for (const el of this.norm.elems) {
      if (el.type === 'C') q[el.id] = el.src.C * this.caps.get(el.id).v;
    }
    return { ok: true, t: this.t, V: res.V, I: res.I, P: res.P, q };
  }

  /** Energy stored in capacitors right now. */
  storedEnergy() {
    const out = {};
    for (const el of this.norm.elems) {
      if (el.type === 'C') { const v = this.caps.get(el.id).v; out[el.id] = 0.5 * el.src.C * v * v; }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Time constants: the natural modes of the RC network
// ---------------------------------------------------------------------------
// With sources zeroed, node voltages obey  C·dv/dt = −G·v, so each mode decays as e^(−t/τ) where
// G·x = μ·C·x and τ = 1/μ. G and C are symmetric positive semi-definite nodal matrices.
// We solve the pencil with a shift: ν = s/(μ + s) are the eigenvalues of L⁻¹(sC)L⁻ᵀ where
// LLᵀ = G + sC. ν → 0 is an algebraic (capacitor-free) direction, ν → 1 is a conserved charge.

function choleskyInPlace(A, n) {
  for (let j = 0; j < n; j++) {
    let d = A[j * n + j];
    for (let k = 0; k < j; k++) d -= A[j * n + k] * A[j * n + k];
    if (!(d > 0)) return false;
    const ljj = Math.sqrt(d);
    A[j * n + j] = ljj;
    for (let i = j + 1; i < n; i++) {
      let v = A[i * n + j];
      for (let k = 0; k < j; k++) v -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = v / ljj;
    }
    for (let k = j + 1; k < n; k++) A[j * n + k] = 0;
  }
  return true;
}

/** Eigenvalues of a symmetric matrix (cyclic Jacobi). Small n only. */
export function symmetricEigenvalues(Ain, n) {
  const A = Float64Array.from(Ain);
  let norm = 0;
  for (let i = 0; i < n * n; i++) norm += A[i] * A[i];
  norm = Math.sqrt(norm);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] ** 2;
    if (Math.sqrt(off) <= 1e-15 * norm || off === 0) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (apq === 0) continue;
        const app = A[p * n + p];
        const aqq = A[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const sn = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k * n + p];
          const akq = A[k * n + q];
          A[k * n + p] = c * akp - sn * akq;
          A[k * n + q] = sn * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p * n + k];
          const aqk = A[q * n + k];
          A[p * n + k] = c * apk - sn * aqk;
          A[q * n + k] = sn * apk + c * aqk;
        }
      }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) out.push(A[i * n + i]);
  return out;
}

/**
 * Time constants of the circuit's natural modes (switches as currently set).
 * Returns { ok, modes: [τ...] sorted ascending, tauMin, tauMax }. tauMin = Infinity when nothing decays.
 */
export function estimateTimeConstants(circuit) {
  const norm = normalize(circuit);
  if (!norm.ok) return { ok: false, reason: norm.reason, modes: [], tauMin: Infinity, tauMax: 0 };
  // Zeroed ideal sources are shorts: merge their nodes.
  const parent = new Map([[norm.ground, norm.ground]]);
  for (const n of norm.nodes) parent.set(n, n);
  const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  for (const el of norm.elems) {
    if (el.type === 'V' && !(el.src.r > 0)) {
      const ra = find(el.a); const rb = find(el.b);
      if (ra !== rb) parent.set(ra, rb);
    }
  }
  const g = find(norm.ground);
  const roots = [...new Set(norm.nodes.map(find))].filter((r) => r !== g);
  const N = roots.length;
  const ix = new Map(roots.map((r, i) => [r, i]));
  ix.set(g, -1);
  const G = new Float64Array(N * N);
  const Cm = new Float64Array(N * N);
  let gTrace = 0;
  let hasCap = false;
  const stamp = (M, a, b, v) => {
    if (a >= 0) M[a * N + a] += v;
    if (b >= 0) M[b * N + b] += v;
    if (a >= 0 && b >= 0) { M[a * N + b] -= v; M[b * N + a] -= v; }
  };
  for (const el of norm.elems) {
    const a = ix.get(find(el.a));
    const b = ix.get(find(el.b));
    if (a === b) continue;
    const s = el.src;
    if (el.type === 'R') { stamp(G, a, b, 1 / s.R); gTrace += 2 / s.R; }
    else if (el.type === 'V' && s.r > 0) { stamp(G, a, b, 1 / s.r); gTrace += 2 / s.r; }
    else if (el.type === 'S' && s.closed) stamp(G, a, b, 1 / SWITCH_CLOSED_R);
    else if (el.type === 'C') { stamp(Cm, a, b, s.C); hasCap = true; }
  }
  if (!hasCap || N === 0) return { ok: true, modes: [], tauMin: Infinity, tauMax: 0 };
  let cTrace = 0;
  for (let i = 0; i < N; i++) cTrace += Cm[i * N + i];
  let sc = gTrace > 0 ? gTrace / cTrace : 1 / cTrace;
  if (!(sc > 0) || !Number.isFinite(sc)) sc = 1;
  const M = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) M[i] = G[i] + sc * Cm[i];
  if (!choleskyInPlace(M, N)) return { ok: false, reason: 'floating node', modes: [], tauMin: Infinity, tauMax: 0 };
  // Y = L⁻¹ (sC), then B = L⁻¹ Yᵀ (B is symmetric because sC is)
  const fwd = (X) => {
    const Y = new Float64Array(N * N);
    for (let col = 0; col < N; col++) {
      for (let i = 0; i < N; i++) {
        let v = X[i * N + col];
        for (let k = 0; k < i; k++) v -= M[i * N + k] * Y[k * N + col];
        Y[i * N + col] = v / M[i * N + i];
      }
    }
    return Y;
  };
  const S = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) S[i] = sc * Cm[i];
  const Y = fwd(S);
  const Yt = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Yt[i * N + j] = Y[j * N + i];
  const B = fwd(Yt);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const avg = 0.5 * (B[i * N + j] + B[j * N + i]);
    B[i * N + j] = avg; B[j * N + i] = avg;
  }
  const nus = symmetricEigenvalues(B, N);
  const modes = [];
  for (const nu of nus) {
    // Thresholds sit well above round-off (a closed switch makes G + sC poorly conditioned).
    if (nu > 1e-10 && 1 - nu > 1e-9) modes.push(nu / (sc * (1 - nu)));
  }
  modes.sort((x, y) => x - y);
  return {
    ok: true,
    modes,
    tauMin: modes.length ? modes[0] : Infinity,
    tauMax: modes.length ? modes[modes.length - 1] : 0,
  };
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/** Equivalent resistance seen between nodes a and b (sources ignored). */
export function equivalentResistance(elements, a, b) {
  const els = elements
    .filter((e) => e.type === 'R' || e.type === 'S')
    .concat([{ type: 'V', id: '__probe', neg: b, pos: a, V: 1 }]);
  const res = solveDC({ ground: b, elements: els });
  if (!res.ok) return NaN;
  const i = res.I.__probe;
  return i !== 0 ? 1 / i : Infinity;
}

/** True when every number in a solver result is finite. */
export function isFiniteResult(res) {
  if (!res || !res.ok) return false;
  for (const group of [res.V, res.I, res.P, res.q]) {
    if (!group) continue;
    for (const k in group) if (!Number.isFinite(group[k])) return false;
  }
  return true;
}
