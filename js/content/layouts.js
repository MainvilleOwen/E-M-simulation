// Schematic layouts for every preset circuit. Pure data, no DOM.
// Coordinates are logical units (the stage scales them). Element ids match the circuit element ids.
// Each wire lists its circuit node (for the potential tint) and its current as a signed combination of
// element currents along the wire's point order (for the dots). A unit test checks Kirchhoff's
// junction rule at every endpoint of every layout, so the dots are conserved.

const W = (id, node, flow, ...pts) => ({ id, node, flow, pts });

/** Attach circuit node names (na, nb) and element refs to a layout, from the circuit with matching ids. */
export function bindLayout(layout, circuit) {
  const byId = new Map(circuit.elements.map((e) => [e.id, e]));
  for (const [id, el] of Object.entries(layout.elements)) {
    const ref = byId.get(el.ref || id);
    if (!ref) continue;
    el.ref = ref;
    if (ref.type === 'V') { el.na = ref.neg; el.nb = ref.pos; } else { el.na = ref.a; el.nb = ref.b; }
    if (!el.flow) el.flow = [[ref.id, 1]];
  }
  return layout;
}

/** Height-map pieces in loop order. */
const P = (id, rev = false, dotStyle) => ({ id, rev, dotStyle });

// ---------- M1 ----------

export function oneLayout() {
  return {
    w: 100, h: 56,
    elements: {
      B: { kind: 'battery', a: [14, 46], b: [14, 12], labelAt: [24, 29], labelAlign: 'left' },
      R1: { kind: 'resistor', a: [38, 12], b: [64, 12], labelSide: 1 },
    },
    wires: [
      W('w1', 'p', [['B', 1]], [14, 12], [38, 12]),
      W('w2', '0', [['R1', 1]], [64, 12], [86, 12], [86, 46], [14, 46]),
    ],
    pieces: [P('B'), P('w1'), P('R1'), P('w2')],
  };
}

export function seriesLayout() {
  return {
    w: 100, h: 56,
    elements: {
      B: { kind: 'battery', a: [14, 46], b: [14, 12], labelAt: [24, 29], labelAlign: 'left' },
      R1: { kind: 'resistor', a: [28, 12], b: [50, 12], labelSide: 1 },
      R2: { kind: 'resistor', a: [60, 12], b: [82, 12], labelSide: 1 },
    },
    wires: [
      W('w1', 'p', [['B', 1]], [14, 12], [28, 12]),
      W('w2', 'm', [['R1', 1]], [50, 12], [60, 12]),
      W('w3', '0', [['R2', 1]], [82, 12], [90, 12], [90, 46], [14, 46]),
    ],
    pieces: [P('B'), P('w1'), P('R1'), P('w2'), P('R2'), P('w3')],
  };
}

/** Parallel as two lanes. withR2 = false gives circuit A (R1 alone) with identical geometry. */
export function parallelLayout(withR2 = true) {
  const L = {
    w: 100, h: 62,
    elements: {
      B: { kind: 'battery', a: [12, 54], b: [12, 12], labelAt: [21, 44], labelAlign: 'left' },
      R1: { kind: 'resistor', a: [40, 12], b: [64, 12], labelSide: 1 },
    },
    wires: [W('wA', 'p', [['B', 1]], [12, 12], [30, 12])],
    junctions: [],
  };
  if (withR2) {
    L.elements.R2 = { kind: 'resistor', a: [40, 32], b: [64, 32], labelSide: -1 };
    L.wires.push(
      W('wL1', 'p', [['R1', 1]], [30, 12], [40, 12]),
      W('wL2', 'p', [['R2', 1]], [30, 12], [30, 32], [40, 32]),
      W('wR1', '0', [['R1', 1]], [64, 12], [76, 12], [76, 32]),
      W('wR2', '0', [['R2', 1]], [64, 32], [76, 32]),
      W('wB', '0', [['B', 1]], [76, 32], [76, 54], [12, 54]),
    );
    L.junctions.push({ at: [30, 12], node: 'p' }, { at: [76, 32], node: '0' });
    L.pieces = [P('B'), P('wA'), P('wL1'), P('R1'), P('wR1'), P('wL2', false, 'ring'), P('R2', false, 'ring'), P('wR2', false, 'ring'), P('wB')];
  } else {
    L.wires.push(
      W('wL1', 'p', [['R1', 1]], [30, 12], [40, 12]),
      W('wR1', '0', [['R1', 1]], [64, 12], [76, 12], [76, 32]),
      W('wB', '0', [['B', 1]], [76, 32], [76, 54], [12, 54]),
    );
    L.pieces = [P('B'), P('wA'), P('wL1'), P('R1'), P('wR1'), P('wB')];
  }
  return L;
}

/**
 * Combination (Ra + Rb) then (Rc ∥ Rd). Stage 0 = full, 1 = Ra+Rb merged, 2 = also Rc∥Rd merged, 3 = one resistor.
 */
export function combinationLayout(stage = 0) {
  const L = {
    w: 100, h: 62,
    elements: { B: { kind: 'battery', a: [8, 54], b: [8, 12], labelAt: [16, 44], labelAlign: 'left' } },
    wires: [], junctions: [], pieces: [P('B')],
  };
  const e = L.elements;
  if (stage >= 3) {
    e.Req = { kind: 'resistor', a: [34, 12], b: [66, 12], labelSide: 1 };
    L.wires.push(W('wA', 'p', [['B', 1]], [8, 12], [34, 12]), W('wB', '0', [['B', 1]], [66, 12], [92, 12], [92, 54], [8, 54]));
    L.pieces.push(P('wA'), P('Req'), P('wB'));
    return L;
  }
  if (stage >= 1) {
    e.Rab = { kind: 'resistor', a: [20, 12], b: [50, 12], labelSide: 1 };
    L.wires.push(W('wA', 'p', [['B', 1]], [8, 12], [20, 12]), W('wM', 'm', [['Rab', 1]], [50, 12], [60, 12]));
    L.pieces.push(P('wA'), P('Rab'), P('wM'));
  } else {
    e.Ra = { kind: 'resistor', a: [14, 12], b: [32, 12], labelSide: 1 };
    e.Rb = { kind: 'resistor', a: [38, 12], b: [56, 12], labelSide: 1 };
    L.wires.push(
      W('wA', 'p', [['B', 1]], [8, 12], [14, 12]),
      W('wX', 'x', [['Ra', 1]], [32, 12], [38, 12]),
      W('wM', 'm', [['Rb', 1]], [56, 12], [60, 12]),
    );
    L.pieces.push(P('wA'), P('Ra'), P('wX'), P('Rb'), P('wM'));
  }
  if (stage >= 2) {
    e.Rcd = { kind: 'resistor', a: [66, 12], b: [86, 12], labelSide: 1 };
    L.wires.push(W('wC1', 'm', [['Rcd', 1]], [60, 12], [66, 12]), W('wB', '0', [['B', 1]], [86, 12], [92, 12], [92, 54], [8, 54]));
    L.pieces.push(P('wC1'), P('Rcd'), P('wB'));
  } else {
    e.Rc = { kind: 'resistor', a: [66, 12], b: [86, 12], labelSide: 1 };
    e.Rd = { kind: 'resistor', a: [66, 32], b: [86, 32], labelSide: -1 };
    L.wires.push(
      W('wC1', 'm', [['Rc', 1]], [60, 12], [66, 12]),
      W('wD1', 'm', [['Rd', 1]], [60, 12], [60, 32], [66, 32]),
      W('wC2', '0', [['Rc', 1]], [86, 12], [92, 12], [92, 32]),
      W('wD2', '0', [['Rd', 1]], [86, 32], [92, 32]),
      W('wB', '0', [['B', 1]], [92, 32], [92, 54], [8, 54]),
    );
    L.junctions.push({ at: [60, 12], node: 'm' }, { at: [92, 32], node: '0' });
    L.pieces.push(P('wC1'), P('Rc'), P('wC2'), P('wD1', false, 'ring'), P('Rd', false, 'ring'), P('wD2', false, 'ring'), P('wB'));
  }
  return L;
}

export function bulbLayout(bothBulbs = true) {
  const L = {
    w: 100, h: 58,
    elements: {
      B: { kind: 'battery', a: [14, 48], b: [14, 14], labelAt: [24, 31], labelAlign: 'left' },
      LA: { kind: 'bulb', a: [26, 14], b: [48, 14], labelSide: 1 },
    },
    wires: [
      W('w1', 'p', [['B', 1]], [14, 14], [26, 14]),
      W('w2', 'm', [['LA', 1]], [48, 14], [60, 14]),
    ],
  };
  if (bothBulbs) {
    L.elements.LB = { kind: 'bulb', a: [60, 14], b: [82, 14], labelSide: 1 };
    L.wires.push(W('w3', '0', [['LB', 1]], [82, 14], [90, 14], [90, 48], [14, 48]));
    L.pieces = [P('B'), P('w1'), P('LA'), P('w2'), P('LB'), P('w3')];
  } else {
    L.elements.W = { kind: 'wire', a: [60, 14], b: [82, 14] };
    L.wires.push(W('w3', '0', [['W', 1]], [82, 14], [90, 14], [90, 48], [14, 48]));
    L.pieces = [P('B'), P('w1'), P('LA'), P('w2'), P('W'), P('w3')];
  }
  return L;
}

/** Two-battery circuit: three vertical branches between the top node t and the bottom node 0. */
export function twoBatteryLayout() {
  return {
    w: 100, h: 66,
    elements: {
      B1: { kind: 'battery', a: [14, 56], b: [14, 36], labelAt: [5, 46], labelAlign: 'center' },
      R1: { kind: 'resistor', a: [14, 36], b: [14, 12], labelAt: [24, 24], labelAlign: 'left' },
      R2: { kind: 'resistor', a: [50, 12], b: [50, 56], labelAt: [60, 34], labelAlign: 'left' },
      R3: { kind: 'resistor', a: [86, 12], b: [86, 36], labelAt: [76, 24], labelAlign: 'right' },
      B2: { kind: 'battery', a: [86, 56], b: [86, 36], labelAt: [95, 46], labelAlign: 'center' },
    },
    wires: [
      W('wTL', 't', [['R1', 1]], [14, 12], [50, 12]),
      W('wTR', 't', [['R3', 1]], [50, 12], [86, 12]),
      W('wBL', '0', [['B1', -1]], [14, 56], [50, 56]),
      W('wBR', '0', [['B2', 1]], [50, 56], [86, 56]),
    ],
    junctions: [{ at: [50, 12], node: 't' }, { at: [50, 56], node: '0' }],
  };
}

/** Loops for the walk. Each step: [trackId, reversed]. Start point = first step's start. */
export const TWO_BATTERY_LOOPS = {
  left: { label: 'Left loop', steps: [['B1', false], ['R1', false], ['wTL', false], ['R2', false], ['wBL', true]] },
  right: { label: 'Right loop', steps: [['R2', true], ['wTR', false], ['R3', false], ['B2', true], ['wBR', true]] },
  outer: { label: 'Outer loop', steps: [['B1', false], ['R1', false], ['wTL', false], ['wTR', false], ['R3', false], ['B2', true], ['wBR', true], ['wBL', true]] },
};

export const SERIES_LOOP = { label: 'The loop', steps: [['B', false], ['w1', false], ['R1', false], ['w2', false], ['R2', false], ['w3', false]] };

// ---------- M2 ----------

/** RC with a two-way switch: Sc puts the battery in the loop; Sd bypasses it. */
export function rcLayout() {
  return {
    w: 100, h: 60,
    elements: {
      B: { kind: 'battery', a: [12, 50], b: [12, 14], labelAt: [5, 32], labelAlign: 'center' },
      Sc: { kind: 'switch', a: [20, 14], b: [36, 14], labelSide: 1 },
      Sd: { kind: 'switch', a: [36, 22], b: [36, 42], labelAt: [42, 32], labelAlign: 'left' },
      R: { kind: 'resistor', a: [46, 14], b: [68, 14], labelSide: 1 },
      C: { kind: 'capacitor', a: [88, 24], b: [88, 40], labelAt: [80, 32], labelAlign: 'right' },
    },
    wires: [
      W('wP', 'p', [['B', 1]], [12, 14], [20, 14]),
      W('wX', 'x', [['R', 1]], [36, 14], [46, 14]),
      W('wXd', 'x', [['Sd', 1]], [36, 14], [36, 22]),
      W('wY', 'y', [['R', 1]], [68, 14], [88, 14], [88, 24]),
      W('wGd', '0', [['Sd', 1]], [36, 42], [36, 50]),
      W('wG1', '0', [['C', 1]], [88, 40], [88, 50], [36, 50]),
      W('wG2', '0', [['B', 1]], [36, 50], [12, 50]),
    ],
    junctions: [{ at: [36, 14], node: 'x' }, { at: [36, 50], node: '0' }],
    pieces: [P('B'), P('wP'), P('Sc'), P('wX'), P('R'), P('wY'), P('C'), P('wG1'), P('wG2')],
  };
}

/** RC Example 1: R1 and R2 along the top, C on the right, switch S from the middle node down. */
export function rcExample1Layout() {
  return {
    w: 100, h: 60,
    elements: {
      B: { kind: 'battery', a: [12, 50], b: [12, 14], labelAt: [5, 32], labelAlign: 'center' },
      R1: { kind: 'resistor', a: [20, 14], b: [42, 14], labelSide: 1 },
      S: { kind: 'switch', a: [50, 24], b: [50, 42], labelAt: [56, 33], labelAlign: 'left' },
      R2: { kind: 'resistor', a: [58, 14], b: [80, 14], labelSide: 1 },
      C: { kind: 'capacitor', a: [90, 26], b: [90, 40], labelAt: [83, 33], labelAlign: 'right' },
    },
    wires: [
      W('wP', 'p', [['B', 1]], [12, 14], [20, 14]),
      W('wM1', 'm', [['R1', 1]], [42, 14], [50, 14]),
      W('wM2', 'm', [['R2', 1]], [50, 14], [58, 14]),
      W('wMs', 'm', [['S', 1]], [50, 14], [50, 24]),
      W('wY', 'y', [['R2', 1]], [80, 14], [90, 14], [90, 26]),
      W('wGs', '0', [['S', 1]], [50, 42], [50, 50]),
      W('wG1', '0', [['C', 1]], [90, 40], [90, 50], [50, 50]),
      W('wG2', '0', [['B', 1]], [50, 50], [12, 50]),
    ],
    junctions: [{ at: [50, 14], node: 'm' }, { at: [50, 50], node: '0' }],
    pieces: [P('B'), P('wP'), P('R1'), P('wM1'), P('wM2'), P('R2'), P('wY'), P('C'), P('wG1'), P('wG2')],
  };
}

/** RC Example 2: switch and R1 to node a; R2 down from a; R3 and C down on the right. */
export function rcExample2Layout() {
  return {
    w: 100, h: 62,
    elements: {
      B: { kind: 'battery', a: [10, 52], b: [10, 14], labelAt: [4, 33], labelAlign: 'center' },
      S: { kind: 'switch', a: [18, 14], b: [32, 14], labelSide: 1 },
      R1: { kind: 'resistor', a: [36, 14], b: [56, 14], labelSide: 1 },
      R2: { kind: 'resistor', a: [62, 22], b: [62, 44], labelAt: [68, 33], labelAlign: 'left' },
      R3: { kind: 'resistor', a: [88, 18], b: [88, 32], labelAt: [82, 25], labelAlign: 'right' },
      C: { kind: 'capacitor', a: [88, 36], b: [88, 48], labelAt: [82, 42], labelAlign: 'right' },
    },
    wires: [
      W('wP', 'p', [['B', 1]], [10, 14], [18, 14]),
      W('wQ', 'q', [['S', 1]], [32, 14], [36, 14]),
      W('wA1', 'a', [['R1', 1]], [56, 14], [62, 14]),
      W('wA2', 'a', [['R2', 1]], [62, 14], [62, 22]),
      W('wA3', 'a', [['R3', 1]], [62, 14], [88, 14], [88, 18]),
      W('wC', 'c', [['R3', 1]], [88, 32], [88, 36]),
      W('wG2', '0', [['R2', 1]], [62, 44], [62, 52]),
      W('wG3', '0', [['C', 1]], [88, 48], [88, 52], [62, 52]),
      W('wG', '0', [['B', 1]], [62, 52], [10, 52]),
    ],
    junctions: [{ at: [62, 14], node: 'a' }, { at: [62, 52], node: '0' }],
    pieces: [P('B'), P('wP'), P('S'), P('wQ'), P('R1'), P('wA1'), P('wA3'), P('R3'), P('wC'), P('C'), P('wG3'), P('wG')],
  };
}

// ---------- M3 ----------

export function capSeriesLayout() {
  return {
    w: 100, h: 60,
    elements: {
      B: { kind: 'battery', a: [10, 50], b: [10, 14], labelAt: [4, 32], labelAlign: 'center' },
      S: { kind: 'switch', a: [18, 14], b: [30, 14], labelSide: 1 },
      Rw: { kind: 'resistor', a: [34, 14], b: [46, 14], labelSide: 1, noPush: true },
      C1: { kind: 'capacitor', a: [52, 14], b: [62, 14], labelAt: [57, 4], labelAlign: 'center' },
      C2: { kind: 'capacitor', a: [88, 26], b: [88, 40], labelAt: [80, 33], labelAlign: 'right' },
    },
    wires: [
      W('wP', 'p', [['B', 1]], [10, 14], [18, 14]),
      W('wW', 'w', [['S', 1]], [30, 14], [34, 14]),
      W('wU', 'u', [['Rw', 1]], [46, 14], [52, 14]),
      W('wI', 'i', [['C1', 1]], [62, 14], [88, 14], [88, 26]),
      W('wG', '0', [['C2', 1]], [88, 40], [88, 50], [10, 50]),
    ],
    pieces: [P('B'), P('wP'), P('S'), P('wW'), P('Rw'), P('wU'), P('C1'), P('wI'), P('C2'), P('wG')],
    island: [[57, 6], [96, 6], [96, 31], [80, 31], [80, 22], [57, 22]],
  };
}

export function capParallelLayout() {
  return {
    w: 100, h: 60,
    elements: {
      B: { kind: 'battery', a: [10, 50], b: [10, 14], labelAt: [4, 32], labelAlign: 'center' },
      S: { kind: 'switch', a: [18, 14], b: [30, 14], labelSide: 1 },
      Rw: { kind: 'resistor', a: [34, 14], b: [46, 14], labelSide: 1, noPush: true },
      C1: { kind: 'capacitor', a: [60, 24], b: [60, 40], labelAt: [53, 32], labelAlign: 'right' },
      C2: { kind: 'capacitor', a: [86, 24], b: [86, 40], labelAt: [79, 32], labelAlign: 'right' },
    },
    wires: [
      W('wP', 'p', [['B', 1]], [10, 14], [18, 14]),
      W('wW', 'w', [['S', 1]], [30, 14], [34, 14]),
      W('wU', 'u', [['Rw', 1]], [46, 14], [60, 14]),
      W('wU1', 'u', [['C1', 1]], [60, 14], [60, 24]),
      W('wU2', 'u', [['C2', 1]], [60, 14], [86, 14], [86, 24]),
      W('wG1', '0', [['C1', 1]], [60, 40], [60, 50]),
      W('wG2', '0', [['C2', 1]], [86, 40], [86, 50], [60, 50]),
      W('wG', '0', [['B', 1]], [60, 50], [10, 50]),
    ],
    junctions: [{ at: [60, 14], node: 'u' }, { at: [60, 50], node: '0' }],
    pieces: [P('B'), P('wP'), P('S'), P('wW'), P('Rw'), P('wU'), P('wU1'), P('C1'), P('wG1'), P('wG')],
  };
}

export function chargeSharingLayout() {
  return {
    w: 100, h: 60,
    elements: {
      C1: { kind: 'capacitor', a: [18, 24], b: [18, 40], labelAt: [10, 32], labelAlign: 'center' },
      S: { kind: 'switch', a: [32, 14], b: [46, 14], labelSide: 1 },
      Rw: { kind: 'resistor', a: [52, 14], b: [66, 14], labelSide: 1, noPush: true },
      C2: { kind: 'capacitor', a: [82, 24], b: [82, 40], labelAt: [90, 32], labelAlign: 'center' },
    },
    wires: [
      W('wU', 'u', [['C1', -1]], [18, 24], [18, 14], [32, 14]),
      W('wW', 'w', [['S', 1]], [46, 14], [52, 14]),
      W('wV', 'v', [['Rw', 1]], [66, 14], [82, 14], [82, 24]),
      W('wG', '0', [['C2', 1]], [82, 40], [82, 50], [18, 50], [18, 40]),
    ],
    pieces: [P('C1', true), P('wU'), P('S'), P('wW'), P('Rw'), P('wV'), P('C2'), P('wG')],
  };
}
