// Field core: Coulomb superposition, field lines, dipole dynamics. Pure, no DOM.
// SI units throughout: positions in metres, charges in coulombs, fields in N/C (= V/m).

export const K = 8.9875517923e9;         // Coulomb constant, N·m²/C²
export const EPS0 = 8.8541878128e-12;    // vacuum permittivity, F/m

/**
 * Electric field at (x, y) from point charges [{x, y, q}].
 * `soft` is a softening length: E = k q r⃗ / (r² + s²)^(3/2), so the field stays finite at a charge.
 */
export function fieldAt(charges, x, y, soft = 0) {
  let Ex = 0;
  let Ey = 0;
  const s2 = soft * soft;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + s2;
    if (r2 === 0) continue;
    const inv = (K * c.q) / (r2 * Math.sqrt(r2));
    Ex += inv * dx;
    Ey += inv * dy;
  }
  return { Ex, Ey };
}

/** Each charge's individual field at (x, y), for showing superposition. */
export function fieldContributions(charges, x, y, soft = 0) {
  return charges.map((c) => fieldAt([c], x, y, soft));
}

/** Electric potential at (x, y), zero at infinity (softened the same way). */
export function potentialAt(charges, x, y, soft = 0) {
  let V = 0;
  const s2 = soft * soft;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r = Math.sqrt(dx * dx + dy * dy + s2);
    if (r > 0) V += (K * c.q) / r;
  }
  return V;
}

export function magnitude(E) { return Math.hypot(E.Ex, E.Ey); }

/**
 * Arrow display length, log-scaled and clamped. Real fields span many orders of magnitude,
 * so a linear scale would show only the arrows next to the charges.
 */
export function arrowLength(mag, { minMag, maxMag, minLen, maxLen }) {
  if (!(mag > 0) || !Number.isFinite(mag)) return minLen;
  const lo = Math.log(minMag);
  const hi = Math.log(maxMag);
  let f = (Math.log(mag) - lo) / (hi - lo);
  if (!Number.isFinite(f)) f = 0;
  f = Math.min(1, Math.max(0, f));
  return minLen + (maxLen - minLen) * f;
}

/**
 * Trace one field line from (x0, y0) with RK4 along the unit field direction.
 * direction +1 follows E (away from + charges), −1 goes against E.
 * Stops on reaching a charge (within stopRadius), leaving bounds, or after maxSteps.
 * Returns { pts: [[x, y], ...], endCharge: index or -1 }.
 */
export function traceFieldLine(charges, x0, y0, opts = {}) {
  const {
    step = 0.002, maxSteps = 2000, soft = 0, direction = 1, stopRadius = 0.004,
    bounds = { x0: -1, y0: -1, x1: 1, y1: 1 },
  } = opts;
  const dirAt = (x, y) => {
    const E = fieldAt(charges, x, y, soft);
    const m = Math.hypot(E.Ex, E.Ey);
    if (!(m > 0)) return null;
    return [(direction * E.Ex) / m, (direction * E.Ey) / m];
  };
  const pts = [[x0, y0]];
  let x = x0;
  let y = y0;
  let endCharge = -1;
  for (let i = 0; i < maxSteps; i++) {
    const k1 = dirAt(x, y); if (!k1) break;
    const k2 = dirAt(x + 0.5 * step * k1[0], y + 0.5 * step * k1[1]); if (!k2) break;
    const k3 = dirAt(x + 0.5 * step * k2[0], y + 0.5 * step * k2[1]); if (!k3) break;
    const k4 = dirAt(x + step * k3[0], y + step * k3[1]); if (!k4) break;
    x += (step / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (step / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    pts.push([x, y]);
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) break;
    let hit = -1;
    for (let c = 0; c < charges.length; c++) {
      const ch = charges[c];
      if (Math.hypot(x - ch.x, y - ch.y) < stopRadius && Math.sign(ch.q) === -direction) { hit = c; break; }
    }
    if (hit >= 0) { pts.push([charges[hit].x, charges[hit].y]); endCharge = hit; break; }
  }
  return { pts, endCharge };
}

/**
 * Field lines for a set of charges. Lines start on + charges (count ∝ q); any − charge that
 * receives fewer lines than its share gets extra lines traced backwards from it.
 */
export function fieldLines(charges, { linesPerUnit = 8, unit = 1e-9, startRadius = 0.006, ...opts } = {}) {
  const lines = [];
  const arrivals = charges.map(() => 0);
  charges.forEach((c, i) => {
    if (c.q <= 0) return;
    const n = Math.max(1, Math.round((linesPerUnit * c.q) / unit));
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n) * Math.PI * 2;
      const line = traceFieldLine(charges, c.x + startRadius * Math.cos(a), c.y + startRadius * Math.sin(a), { ...opts, direction: 1 });
      if (line.endCharge >= 0) arrivals[line.endCharge]++;
      lines.push({ pts: line.pts, from: i, to: line.endCharge });
    }
  });
  charges.forEach((c, i) => {
    if (c.q >= 0) return;
    const share = Math.max(1, Math.round((linesPerUnit * -c.q) / unit));
    const need = share - arrivals[i];
    for (let k = 0; k < need; k++) {
      const a = ((k + 0.25) / need) * Math.PI * 2;
      const line = traceFieldLine(charges, c.x + startRadius * Math.cos(a), c.y + startRadius * Math.sin(a), { ...opts, direction: -1 });
      lines.push({ pts: line.pts.slice().reverse(), from: -1, to: i });
    }
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Electric dipole in a uniform field E along +x
// ---------------------------------------------------------------------------
// Charges +q and −q sit at ±(d/2)(cos θ, sin θ) from the centre; p = q·d points from − to +.

export function dipoleCharges(q, d, theta, cx = 0, cy = 0) {
  const hx = (d / 2) * Math.cos(theta);
  const hy = (d / 2) * Math.sin(theta);
  return [
    { x: cx + hx, y: cy + hy, q },
    { x: cx - hx, y: cy - hy, q: -q },
  ];
}

/** Forces and torque (about the centre) on a dipole in uniform field E (along +x). */
export function dipoleForces(q, d, E, theta) {
  const [plus, minus] = dipoleCharges(q, d, theta);
  const Fp = { x: q * E, y: 0 };
  const Fm = { x: -q * E, y: 0 };
  const torque = (plus.x * Fp.y - plus.y * Fp.x) + (minus.x * Fm.y - minus.y * Fm.x);
  return { Fplus: Fp, Fminus: Fm, net: { x: Fp.x + Fm.x, y: Fp.y + Fm.y }, torque, plus, minus };
}

/** Signed torque (counter-clockwise positive): τ = −pE sin θ. Its magnitude is pE sin θ. */
export function dipoleTorque(p, E, theta) { return -p * E * Math.sin(theta); }

/** Potential energy U = −pE cos θ. */
export function dipoleEnergy(p, E, theta) { return -p * E * Math.cos(theta); }

/**
 * One RK4 step of damped rotation: I·θ'' = −pE sin θ − b·θ'.
 * state = { theta, omega }, params = { p, E, I, b }.
 */
export function stepDipole(state, params, dt) {
  const { p, E, I, b = 0 } = params;
  const acc = (th, om) => (-p * E * Math.sin(th) - b * om) / I;
  const { theta, omega } = state;
  const k1t = omega; const k1w = acc(theta, omega);
  const k2t = omega + 0.5 * dt * k1w; const k2w = acc(theta + 0.5 * dt * k1t, omega + 0.5 * dt * k1w);
  const k3t = omega + 0.5 * dt * k2w; const k3w = acc(theta + 0.5 * dt * k2t, omega + 0.5 * dt * k2w);
  const k4t = omega + dt * k3w; const k4w = acc(theta + dt * k3t, omega + dt * k3w);
  return {
    theta: theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    omega: omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
  };
}

/** Wrap an angle to (−π, π]. */
export function wrapAngle(a) {
  let x = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  if (x === -Math.PI) x = Math.PI;
  return x;
}
