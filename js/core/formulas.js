// Analytic helpers for Ch 25–27 quantities. Pure, no DOM.
// These are used for problem statements and as an independent cross-check of the circuit solver.

import { EPS0 } from './fields.js';

export const E_CHARGE = 1.602176634e-19; // C

// ---------- Ch 26: current and resistance ----------
export const wireArea = (diameter) => Math.PI * (diameter / 2) ** 2;
export const areaFromRadius = (r) => Math.PI * r * r;
export const currentDensity = (I, A) => I / A;
export const driftSpeed = (I, n, A, q = E_CHARGE) => I / (n * q * A);
export const resistance = (rho, L, A) => (rho * L) / A;
export const resistancePerLength = (rho, A) => rho / A;
export const fieldInWire = (rho, J) => rho * J;
export const resistanceAtT = (R0, alpha, T, T0 = 20) => R0 * (1 + alpha * (T - T0));
export const tempForResistance = (R, R0, alpha, T0 = 20) => T0 + (R / R0 - 1) / alpha;
export const powerIR = (I, R) => I * I * R;
export const powerVR = (V, R) => (V * V) / R;

// ---------- Combinations ----------
export const seriesR = (...rs) => rs.reduce((s, r) => s + r, 0);
export const parallelR = (...rs) => 1 / rs.reduce((s, r) => s + 1 / r, 0);
export const parallelC = (...cs) => cs.reduce((s, c) => s + c, 0);
export const seriesC = (...cs) => 1 / cs.reduce((s, c) => s + 1 / c, 0);

// ---------- Ch 25: capacitance ----------
export const plateCapacitance = (A, d, kappa = 1) => (kappa * EPS0 * A) / d;
export const plateAreaFor = (C, d) => (C * d) / EPS0;
export const capEnergy = (C, V) => 0.5 * C * V * V;
export const capEnergyQ = (Q, C) => (Q * Q) / (2 * C);
export const energyDensity = (E) => 0.5 * EPS0 * E * E;
export const fieldForEnergyDensity = (u) => Math.sqrt((2 * u) / EPS0);
/** Attractive force between the plates of a parallel-plate capacitor holding charge Q. */
export const plateForce = (Q, A) => (Q * Q) / (2 * EPS0 * A);

/** Two capacitors joined + to + after one was charged: final shared voltage and energies. */
export function chargeSharing(C1, V1, C2, V2 = 0) {
  const Q = C1 * V1 + C2 * V2;
  const V = Q / (C1 + C2);
  const Ui = capEnergy(C1, V1) + capEnergy(C2, V2);
  const Uf = capEnergy(C1 + C2, V);
  return { Q, V, Q1: C1 * V, Q2: C2 * V, Ui, Uf, lost: Ui - Uf };
}

// ---------- Ch 27: RC ----------
export const rcChargeQ = (t, emf, R, C) => C * emf * (1 - Math.exp(-t / (R * C)));
export const rcChargeI = (t, emf, R, C) => (emf / R) * Math.exp(-t / (R * C));
export const rcDischargeQ = (t, Q0, R, C) => Q0 * Math.exp(-t / (R * C));
export const rcDischargeI = (t, Q0, R, C) => (Q0 / (R * C)) * Math.exp(-t / (R * C));
