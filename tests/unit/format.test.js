import { describe, it, expect } from 'vitest';
import { formatSI, toSig, formatSigned, formatSci, parseAnswer, withinTolerance } from '../../js/core/format.js';

const T = ' ';

describe('formatSI (SI prefixes, 3 significant figures)', () => {
  it('formats with prefixes', () => {
    expect(formatSI(0.000333, 'A')).toBe(`333${T}µA`);
    expect(formatSI(4 / 3, 'A')).toBe(`1.33${T}A`);
    expect(formatSI(14, 'Ω')).toBe(`14.0${T}Ω`);
    expect(formatSI(3.5417e-9, 'F')).toBe(`3.54${T}nF`);
    expect(formatSI(2e6, 'V/m')).toBe(`2.00${T}MV/m`);
    expect(formatSI(50e3, 'Ω')).toBe(`50.0${T}kΩ`);
    expect(formatSI(1800, 'W')).toBe(`1.80${T}kW`);
    expect(formatSI(0.0576, 'J')).toBe(`57.6${T}mJ`);
    expect(formatSI(120, 'V')).toBe(`120${T}V`);
  });
  it('handles rounding across prefix boundaries', () => {
    expect(formatSI(0.9996, 'A')).toBe(`1.00${T}A`);
    expect(formatSI(999.6, 'A')).toBe(`1.00${T}kA`);
    expect(formatSI(0.0009996, 'A')).toBe(`1.00${T}mA`);
    expect(toSig(9.996, 3)).toBe('10.0');
  });
  it('handles zero, negatives and non-finite values without printing NaN', () => {
    expect(formatSI(0, 'A')).toBe(`0.00${T}A`);
    expect(formatSI(-0.002, 'A')).toBe(`-2.00${T}mA`);
    expect(formatSI(NaN, 'A')).toBe('—');
    expect(formatSI(Infinity, 'A')).toBe('—');
    expect(formatSigned(-1.5, 'V')).toBe(`−1.50${T}V`);
    expect(formatSigned(12, 'V')).toBe(`+12.0${T}V`);
  });
  it('scientific notation', () => {
    expect(formatSci(1.1294e8, 'm²')).toBe(`1.13×10⁸${T}m²`);
    expect(formatSci(1.5e-4)).toBe('1.50×10⁻⁴');
  });
});

describe('parseAnswer and tolerance', () => {
  it('parses typed answers with prefixes and units', () => {
    expect(parseAnswer('333 uA', 'A')).toBeCloseTo(333e-6, 12);
    expect(parseAnswer('333µA', 'A')).toBeCloseTo(333e-6, 12);
    expect(parseAnswer('1.5e-4', 'm/s')).toBeCloseTo(1.5e-4, 12);
    expect(parseAnswer('14', 'Ω')).toBe(14);
    expect(parseAnswer('14 ohms', 'Ω')).toBe(14);
    expect(parseAnswer('2.0 k', 'Ω')).toBe(2000);
    expect(parseAnswer('5 mm', 'm')).toBeCloseTo(0.005, 12);
    expect(parseAnswer('3.54 nF', 'F')).toBeCloseTo(3.54e-9, 18);
    expect(parseAnswer('abc', 'A')).toBeNaN();
    expect(parseAnswer('', 'A')).toBeNaN();
  });
  it('accepts within 2%', () => {
    expect(withinTolerance(1.02, 1.0)).toBe(true);
    expect(withinTolerance(1.021, 1.0)).toBe(false);
    expect(withinTolerance(-0.99, -1.0)).toBe(true);
    expect(withinTolerance(NaN, 1)).toBe(false);
  });
});
