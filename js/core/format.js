// SI formatting with prefixes and 3 significant figures. Pure, no DOM.

const PREFIXES = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
  [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
];

/** Round to `sig` significant figures and return the string with trailing zeros kept. */
export function toSig(value, sig = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return (0).toFixed(Math.max(0, sig - 1));
  const mag = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, sig - 1 - mag);
  let s = value.toFixed(decimals);
  // toFixed can round 9.995 up to 10.00: recompute with one fewer decimal if digits overflowed.
  const digits = s.replace('-', '').replace('.', '').replace(/^0+/, '').length;
  if (digits > sig && decimals > 0) s = value.toFixed(decimals - 1);
  return s;
}

/**
 * Format a value with an SI prefix and `sig` significant figures, e.g. formatSI(0.000333, 'A') → "333 µA".
 * Non-finite input returns an em dash so "NaN" never reaches the page.
 */
export function formatSI(value, unit = '', { sig = 3, space = true } = {}) {
  const sep = space && unit ? ' ' : '';
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return `${toSig(0, sig)}${sep}${unit}`;
  const abs = Math.abs(value);
  // A prefix on a squared or cubed unit would scale the unit too (1 mm² = 10⁻⁶ m², not 10⁻³ m²),
  // so area and volume units are written plainly or in scientific notation.
  if (/^[A-Za-zµ]+[²³]/.test(unit)) {
    return abs >= 0.01 && abs < 1e4 ? `${toSig(value, sig)}${sep}${unit}` : formatSci(value, unit, sig);
  }
  // Resistances between 1 mΩ and 1 Ω read more naturally as 0.500 Ω.
  if (unit === 'Ω' && abs >= 1e-3 && abs < 0.9995) return `${toSig(value, sig)}${sep}${unit}`;
  // Below the smallest prefix, use scientific notation instead of long strings of zeros.
  if (abs < 1e-15 * 0.9995) return formatSci(value, unit, sig);
  let chosen = PREFIXES[PREFIXES.length - 1];
  for (const p of PREFIXES) {
    if (abs >= p[0] * 0.9995) { chosen = p; break; }
  }
  if (abs >= 1e15) chosen = PREFIXES[0];
  let scaled = value / chosen[0];
  let text = toSig(scaled, sig);
  // Rounding may push 999.6 → 1000: move up one prefix.
  if (Math.abs(parseFloat(text)) >= 1000 && chosen !== PREFIXES[0]) {
    const idx = PREFIXES.indexOf(chosen);
    chosen = PREFIXES[idx - 1];
    scaled = value / chosen[0];
    text = toSig(scaled, sig);
  }
  if (/^-0(\.0*)?$/.test(text)) text = text.slice(1);
  return `${text}${sep}${chosen[1]}${unit}`;
}

/** Plain number to `sig` significant figures without prefix (for things like percentages). */
export function formatNum(value, sig = 3) {
  return toSig(value, sig);
}

/** Signed version: always shows + or − (used in loop-rule sums). */
export function formatSigned(value, unit = '', opts) {
  if (!Number.isFinite(value)) return '—';
  const s = formatSI(Math.abs(value), unit, opts);
  const isZero = parseFloat(s) === 0;
  if (isZero) return s;
  return (value < 0 ? '−' : '+') + s;
}

/** Scientific notation like "1.13×10⁸" for problem statements that use it. */
export function formatSci(value, unit = '', sig = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return `0${unit ? ' ' + unit : ''}`;
  let exp = Math.floor(Math.log10(Math.abs(value)));
  let mant = value / 10 ** exp;
  let m = toSig(mant, sig);
  if (Math.abs(parseFloat(m)) >= 10) { exp += 1; mant = value / 10 ** exp; m = toSig(mant, sig); }
  const sup = String(exp).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const body = exp === 0 ? m : `${m}×10${sup}`;
  return unit ? `${body} ${unit}` : body;
}

/** Parse a typed answer that may include an SI prefix and unit, e.g. "333 uA", "1.5e-4", "2.0 kΩ". */
export function parseAnswer(text, unit = '') {
  if (text == null) return NaN;
  let s = String(text).trim().replace(/−/g, '-').replace(/\s+/g, '');
  // A single comma with no point is a decimal comma ("2,50") unless it looks like thousands ("2,500").
  if (!s.includes('.') && (s.match(/,/g) || []).length === 1 && !/^[-+]?\d{1,3},\d{3}(\D|$)/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  s = s.replace(/×10\^?/g, 'e').replace(/x10\^/gi, 'e').replace(/\*10\^/g, 'e');
  if (unit) {
    const u = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(u + '$'), '');
    if (unit === 'Ω') s = s.replace(/(ohms?|Ohms?)$/i, '');
    if (unit === '°C') s = s.replace(/(C|degC|deg)$/i, '');
  }
  const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)([TGMkmuµnpf]?)$/);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const mult = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, '': 1, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[m[2]];
  return num * mult;
}

/** True if `answer` is within `tol` (fractional) of `expected`. */
export function withinTolerance(answer, expected, tol = 0.02) {
  if (!Number.isFinite(answer) || !Number.isFinite(expected)) return false;
  if (expected === 0) return Math.abs(answer) < 1e-12;
  return Math.abs(answer - expected) <= tol * Math.abs(expected) * (1 + 1e-9);
}

/**
 * Format several values that appear in one equation with the same prefix (chosen from the largest),
 * so a sum never mixes A and mA. Returns an array of strings.
 */
export function formatSame(values, unit = '', { sig = 3 } = {}) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return values.map(() => '—');
  const big = Math.max(...finite.map((v) => Math.abs(v)));
  const ref = formatSI(big, unit, { sig });
  const prefix = big === 0 ? '' : ref.replace(/^[-\d.]+\s?/, '').replace(/×10\S*\s?/, '').slice(0, -unit.length || undefined);
  const mult = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, '': 1, m: 1e-3, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[prefix] ?? 1;
  const decimalsFor = (x) => {
    const bigScaled = big / mult;
    const mag = bigScaled > 0 ? Math.floor(Math.log10(bigScaled)) : 0;
    return Math.max(0, sig - 1 - mag);
  };
  return values.map((v) => {
    if (!Number.isFinite(v)) return '—';
    let t = (v / mult).toFixed(decimalsFor(v));
    if (/^-0(\.0*)?$/.test(t)) t = t.slice(1);
    return `${t} ${prefix}${unit}`;
  });
}
