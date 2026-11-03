// Colour helpers. Potential uses viridis (perceptually uniform, colourblind-safe),
// truncated at the dark end so low potential still reads on the dark panel.

const VIRIDIS = [
  [0.0, [68, 1, 84]], [0.125, [71, 44, 122]], [0.25, [59, 81, 139]], [0.375, [44, 113, 142]],
  [0.5, [33, 144, 141]], [0.625, [39, 173, 129]], [0.75, [92, 200, 99]], [0.875, [170, 220, 50]], [1.0, [253, 231, 37]],
];
const LOW = 0.2;

function viridisRGB(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < VIRIDIS.length; i++) {
    const [t1, c1] = VIRIDIS[i];
    if (x <= t1) {
      const [t0, c0] = VIRIDIS[i - 1];
      const f = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f));
    }
  }
  return VIRIDIS[VIRIDIS.length - 1][1];
}

/** Colour for a fraction f ∈ [0, 1] of the screen's potential range. */
export function potentialRGB(f) {
  return viridisRGB(LOW + (1 - LOW) * (Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0));
}

export function potentialColor(f, alpha = 1) {
  const [r, g, b] = potentialRGB(f);
  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** Colour for a voltage V given the screen's range. */
export function colorForV(V, vMin, vMax, alpha = 1) {
  const span = vMax - vMin;
  const f = span > 1e-12 ? (V - vMin) / span : 0.5;
  return potentialColor(f, alpha);
}

/** CSS gradient string for the legend bar. */
export function potentialGradientCSS() {
  const stops = [];
  for (let i = 0; i <= 8; i++) stops.push(`${potentialColor(i / 8)} ${(i / 8) * 100}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export const COLORS = {
  panel: '#121826',
  panel2: '#1b2334',
  grid: 'rgba(154,165,187,0.18)',
  axis: 'rgba(200,208,224,0.55)',
  ink: '#e8ecf4',
  muted: '#9aa5bb',
  dot: '#ffffff',
  dotStroke: '#0b0f18',
  pos: '#d55e00',
  neg: '#56b4e9',
  push: '#cc79a7',
  highlight: '#00c896',
  accent: '#56b4e9',
  trace: '#56b4e9',
  trace2: '#e69f00',
  trace3: '#cc79a7',
  ghost: 'rgba(200,208,224,0.45)',
  field: 'rgba(214,220,232,0.85)',
  bulbOff: '#3a4356',
  bulbGlow: [255, 214, 120],
};

export function rgba(hex, a) {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
